import status from "http-status";
import crypto from "node:crypto";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    requireOrgMembership,
    toIso,
    toWireProjectStatus,
} from "../portal.policy";
import type {
    ApprovalStatusWire,
    ChangeRequestStatusWire,
    CommentVisibilityWire,
    ICustomerProjectActivity,
    ICustomerProjectActivityEntry,
    ICustomerProjectComment,
    ICustomerProjectDetail,
    ICustomerProjectMilestone,
} from "./project-detail.type";
import type {
    ActivityQuery,
    ApprovalRespondBody,
    ChangeRequestBody,
    CommentBody,
    FileUploadBody,
} from "./project-detail.validation";

const mapApprovalStatus = (raw: string): ApprovalStatusWire => {
    switch (raw) {
        case "APPROVED":
            return "approved";
        case "CHANGES_REQUESTED":
            return "changes-requested";
        case "REJECTED":
            return "rejected";
        default:
            return "pending";
    }
};

const mapChangeStatus = (raw: string): ChangeRequestStatusWire => {
    switch (raw) {
        case "ACCEPTED":
            return "accepted";
        case "DECLINED":
            return "declined";
        default:
            return "open";
    }
};

const mapVisibility = (raw: string): CommentVisibilityWire => {
    if (raw === "ALL") return "all";
    if (raw === "INTERNAL") return "internal";
    return "customer";
};

const findProjectForUser = async (userId: string, slug: string) => {
    const project = await prisma.project.findFirst({
        where: { slug, isDeleted: false },
        include: {
            organization: {
                select: {
                    id: true,
                    members: {
                        where: { userId },
                        select: { role: true },
                    },
                },
            },
        },
    });
    if (!project) {
        throw new AppError(status.NOT_FOUND, "Project not found.", {
            code: "PROJECT_NOT_FOUND",
        });
    }
    requireOrgMembership(userId, project.organization.id);
    return project;
};

const getDetail = async (
    userId: string,
    slug: string,
): Promise<ICustomerProjectDetail> => {
    const project = await prisma.project.findFirst({
        where: { slug, isDeleted: false },
        include: {
            teamMembers: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true,
                        },
                    },
                },
            },
            milestones: {
                orderBy: [{ orderIndex: "asc" }, { dueAt: "asc" }],
            },
            deliverables: { select: { id: true, status: true } },
            approvals: {
                where: { status: "PENDING" },
                select: { id: true },
            },
        },
    });
    if (!project) {
        throw new AppError(status.NOT_FOUND, "Project not found.", {
            code: "PROJECT_NOT_FOUND",
        });
    }
    requireOrgMembership(userId, project.organizationId);

    const milestones: ICustomerProjectMilestone[] = project.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        dueAt: toIso(m.dueAt),
        completedAt: toIso(m.completedAt),
        orderIndex: m.orderIndex,
    }));

    const nextMilestone = milestones.find((m) => !m.completedAt) ?? null;

    const total = project.deliverables.length;
    const done = project.deliverables.filter((d) => d.status === "COMPLETE").length;
    const progress = total === 0 ? null : Math.min(1, done / total);

    return {
        id: project.id,
        slug: project.slug,
        name: project.name,
        tagline: project.tagline,
        description: project.description,
        status: toWireProjectStatus(project.status),
        phase: project.status === "IN_PROGRESS" ? "build" : "discovery",
        health: nextMilestone?.dueAt
            ? new Date(nextMilestone.dueAt).getTime() < Date.now()
                ? "at-risk"
                : "on-track"
            : "on-track",
        progress,
        coverImageUrl: project.heroImageUrl,
        startedAt: toIso(project.startedAt),
        estimatedDeliveryAt: toIso(project.targetDeliveryAt),
        nextMilestone: nextMilestone
            ? { title: nextMilestone.title, dueAt: nextMilestone.dueAt }
            : null,
        team: project.teamMembers.map((member) => ({
            userId: member.user.id,
            name: member.user.name,
            email: member.user.email,
            role: member.role,
            avatarUrl: member.user.avatarUrl,
        })),
        milestones,
        pendingApprovals: project.approvals.length,
    };
};

const getActivity = async (
    userId: string,
    slug: string,
    query: ActivityQuery,
): Promise<ICustomerProjectActivity> => {
    const project = await findProjectForUser(userId, slug);

    const [rows, total] = await Promise.all([
        prisma.projectActivity.findMany({
            where: { projectId: project.id },
            orderBy: { occurredAt: "desc" },
            skip: (query.page - 1) * query.perPage,
            take: query.perPage,
        }),
        prisma.projectActivity.count({ where: { projectId: project.id } }),
    ]);

    const entries: ICustomerProjectActivityEntry[] = rows.map((row) => ({
        id: row.id,
        kind: row.kind as ICustomerProjectActivityEntry["kind"],
        title: row.title,
        description: row.description,
        actorName: row.actorName,
        occurredAt: row.occurredAt.toISOString(),
        referenceId: row.referenceId,
    }));

    return {
        projectId: project.id,
        entries,
        page: query.page,
        perPage: query.perPage,
        total,
    };
};

const postComment = async (
    userId: string,
    slug: string,
    body: CommentBody,
): Promise<ICustomerProjectComment> => {
    const project = await findProjectForUser(userId, slug);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, avatarUrl: true },
    });

    const visibilityEnum =
        body.visibility === "all"
            ? "ALL"
            : body.visibility === "internal"
                ? "INTERNAL"
                : "CUSTOMER";

    const created = await prisma.projectComment.create({
        data: {
            projectId: project.id,
            authorId: userId,
            body: body.body,
            visibility: visibilityEnum,
            parentId: body.parentId ?? null,
        },
    });

    await prisma.projectActivity.create({
        data: {
            projectId: project.id,
            kind: "COMMENT_POSTED",
            title: "New comment",
            description: body.body.slice(0, 140),
            actorName: user?.name ?? "Unknown",
            occurredAt: new Date(),
            referenceId: created.id,
        },
    });

    return {
        id: created.id,
        body: created.body,
        visibility: mapVisibility(created.visibility),
        authorName: user?.name ?? "Unknown",
        authorAvatarUrl: user?.avatarUrl ?? null,
        createdAt: created.createdAt.toISOString(),
        replies: [],
    };
};

const uploadFile = async (
    userId: string,
    slug: string,
    body: FileUploadBody,
) => {
    const project = await findProjectForUser(userId, slug);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    const created = await prisma.projectFile.create({
        data: {
            projectId: project.id,
            uploaderId: userId,
            name: body.name,
            mimeType: body.mimeType,
            size: body.size,
            url: body.url,
        },
    });

    await prisma.projectActivity.create({
        data: {
            projectId: project.id,
            kind: "FILE_UPLOADED",
            title: `File uploaded: ${body.name}`,
            description: null,
            actorName: user?.name ?? "Unknown",
            occurredAt: new Date(),
            referenceId: created.id,
        },
    });

    return {
        id: created.id,
        name: created.name,
        mimeType: created.mimeType,
        size: created.size,
        url: created.url,
        uploadedByName: user?.name ?? "Unknown",
        uploadedAt: created.createdAt.toISOString(),
    };
};

const respondToApproval = async (
    userId: string,
    approvalId: string,
    body: ApprovalRespondBody,
) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    const approval = await prisma.approvalRequest.findUnique({
        where: { id: approvalId },
    });
    if (!approval) {
        throw new AppError(status.NOT_FOUND, "Approval request not found.", {
            code: "APPROVAL_NOT_FOUND",
        });
    }

    await findProjectForUser(userId, approval.projectId);

    const newStatus =
        body.decision === "approved"
            ? "APPROVED"
            : body.decision === "changes-requested"
                ? "CHANGES_REQUESTED"
                : "REJECTED";

    await prisma.$transaction(async (tx) => {
        await tx.approvalRequest.update({
            where: { id: approval.id },
            data: { status: newStatus, respondedAt: new Date() },
        });
        await tx.approvalResponse.create({
            data: {
                approvalId: approval.id,
                responderId: userId,
                decision: newStatus,
                note: body.note ?? null,
            },
        });
        await tx.projectActivity.create({
            data: {
                projectId: approval.projectId,
                kind: "APPROVAL_RESPONDED",
                title: `Approval ${body.decision}: ${approval.title}`,
                description: body.note ?? null,
                actorName: user?.name ?? "Unknown",
                occurredAt: new Date(),
                referenceId: approval.id,
            },
        });
    });

    return {
        id: approval.id,
        status: mapApprovalStatus(newStatus),
        respondedAt: new Date().toISOString(),
    };
};

const submitChangeRequest = async (
    userId: string,
    slug: string,
    body: ChangeRequestBody,
) => {
    const project = await findProjectForUser(userId, slug);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    const created = await prisma.changeRequest.create({
        data: {
            projectId: project.id,
            submittedById: userId,
            title: body.title,
            description: body.description,
            impact: body.impact.toUpperCase(),
            status: "OPEN",
        },
    });

    await prisma.projectActivity.create({
        data: {
            projectId: project.id,
            kind: "CHANGE_REQUEST_SUBMITTED",
            title: `Change request: ${body.title}`,
            description: null,
            actorName: user?.name ?? "Unknown",
            occurredAt: new Date(),
            referenceId: created.id,
        },
    });

    return {
        id: created.id,
        title: created.title,
        description: created.description,
        status: mapChangeStatus(created.status),
        submittedByName: user?.name ?? "Unknown",
        submittedAt: created.createdAt.toISOString(),
        respondedAt: null,
        respondedByName: null,
        responseNote: null,
    };
};

void crypto;
export const projectDetailService = {
    getDetail,
    getActivity,
    postComment,
    uploadFile,
    respondToApproval,
    submitChangeRequest,
};