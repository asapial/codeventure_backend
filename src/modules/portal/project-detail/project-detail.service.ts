import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    toIso,
    toWireProjectStatus,
} from "../portal.policy";
import type {
    ApprovalStatusWire,
    ChangeRequestStatusWire,
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
        default:
            return "pending";
    }
};

const mapChangeStatus = (raw: string): ChangeRequestStatusWire => {
    switch (raw) {
        case "APPROVED":
            return "accepted";
        case "CHANGES_REQUESTED":
        case "CANCELLED":
            return "declined";
        default:
            return "open";
    }
};

/**
 * Permission check for project-level operations.
 *
 * The schema scopes a project by `ownerId` + `ProjectMember`, not by an
 * organisation. So we allow either: the user owns the project, OR they are a
 * member of it. Returning the project row so callers can reuse it.
 */
const findAccessibleProject = async (userId: string, slug: string) => {
    const project = await prisma.project.findFirst({
        where: { slug, isDeleted: false },
        select: {
            id: true,
            ownerId: true,
            members: { where: { userId }, select: { role: true } },
        },
    });
    if (!project) {
        throw new AppError(status.NOT_FOUND, "Project not found.", {
            code: "PROJECT_NOT_FOUND",
        });
    }
    if (project.ownerId !== userId && project.members.length === 0) {
        throw new AppError(
            status.FORBIDDEN,
            "You do not have access to this project.",
            { code: "PROJECT_ACCESS_DENIED" },
        );
    }
    return project;
};

/** Same as above but takes the project ID (for routes that already resolved). */
const assertProjectAccessById = async (userId: string, projectId: string) => {
    const project = await prisma.project.findFirst({
        where: { id: projectId, isDeleted: false },
        select: { id: true, ownerId: true, slug: true, members: { where: { userId }, select: { role: true } } },
    });
    if (!project) {
        throw new AppError(status.NOT_FOUND, "Project not found.", {
            code: "PROJECT_NOT_FOUND",
        });
    }
    if (project.ownerId !== userId && project.members.length === 0) {
        throw new AppError(
            status.FORBIDDEN,
            "You do not have access to this project.",
            { code: "PROJECT_ACCESS_DENIED" },
        );
    }
    return project;
};

const derivePhase = (status: string): ICustomerProjectDetail["phase"] => {
    switch (status) {
        case "DRAFT":
        case "PLANNING":
            return "discovery";
        case "IN_PROGRESS":
            return "build";
        case "IN_REVIEW":
            return "review";
        case "LAUNCHED":
            return "launch";
        case "PAUSED":
            return "maintenance";
        default:
            return "discovery";
    }
};

const deriveHealth = (
    nextDueAt: string | null,
): ICustomerProjectDetail["health"] => {
    if (!nextDueAt) return "on-track";
    if (new Date(nextDueAt).getTime() < Date.now()) return "at-risk";
    return "on-track";
};

const getDetail = async (
    userId: string,
    slug: string,
): Promise<ICustomerProjectDetail> => {
    const access = await findAccessibleProject(userId, slug);
    const project = await prisma.project.findUnique({
        where: { id: access.id },
        select: {
            id: true,
            slug: true,
            name: true,
            tagline: true,
            description: true,
            status: true,
            heroImageUrl: true,
            startDate: true,
            targetEndDate: true,
            updatedAt: true,
            members: {
                select: {
                    role: true,
                    joinedAt: true,
                    user: {
                        select: { id: true, name: true, email: true, image: true },
                    },
                },
            },
            milestones: {
                orderBy: [{ orderIndex: "asc" }, { dueAt: "asc" }],
            },
            deliverables: { select: { id: true, status: true } },
            approvalRequests: {
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
        phase: derivePhase(project.status),
        health: deriveHealth(nextMilestone?.dueAt ?? null),
        progress,
        coverImageUrl: project.heroImageUrl,
        startedAt: toIso(project.startDate),
        estimatedDeliveryAt: toIso(project.targetEndDate),
        nextMilestone: nextMilestone
            ? { title: nextMilestone.title, dueAt: nextMilestone.dueAt }
            : null,
        team: project.members.map((member) => ({
            userId: member.user.id,
            name: member.user.name,
            email: member.user.email,
            role: member.role,
            avatarUrl: member.user.image,
        })),
        milestones,
        pendingApprovals: project.approvalRequests.length,
    };
};

const getActivity = async (
    userId: string,
    slug: string,
    query: ActivityQuery,
): Promise<ICustomerProjectActivity> => {
    const project = await findAccessibleProject(userId, slug);

    const [rows, total] = await Promise.all([
        prisma.activityEvent.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.perPage,
            take: query.perPage,
            select: {
                id: true,
                type: true,
                title: true,
                description: true,
                createdAt: true,
                actorId: true,
            },
        }),
        prisma.activityEvent.count({ where: { projectId: project.id } }),
    ]);

    // Look up actor names in one query.
    const actorIds = Array.from(
        new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v)),
    );
    const actorRows = actorIds.length
        ? await prisma.user.findMany({
              where: { id: { in: actorIds } },
              select: { id: true, name: true },
          })
        : [];
    const actorMap = new Map(actorRows.map((a) => [a.id, a.name]));

    const entries: ICustomerProjectActivityEntry[] = rows.map((row) => ({
        id: row.id,
        kind: row.type as ICustomerProjectActivityEntry["kind"],
        title: row.title,
        description: row.description ?? null,
        actorName: row.actorId ? (actorMap.get(row.actorId) ?? "Unknown") : "System",
        occurredAt: row.createdAt.toISOString(),
        referenceId: null,
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
    const project = await findAccessibleProject(userId, slug);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, image: true },
    });

    const created = await prisma.projectComment.create({
        data: {
            projectId: project.id,
            authorId: userId,
            body: body.body,
        },
        select: {
            id: true,
            body: true,
            createdAt: true,
        },
    });

    await prisma.activityEvent.create({
        data: {
            projectId: project.id,
            actorId: userId,
            type: "COMMENT_POSTED",
            title: "New comment",
            description: body.body.slice(0, 140),
        },
    });

    return {
        id: created.id,
        body: created.body,
        visibility: "all",
        authorName: user?.name ?? "Unknown",
        authorAvatarUrl: user?.image ?? null,
        createdAt: created.createdAt.toISOString(),
        replies: [],
    };
};

const uploadFile = async (
    userId: string,
    slug: string,
    body: FileUploadBody,
) => {
    const project = await findAccessibleProject(userId, slug);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    const created = await prisma.projectFile.create({
        data: {
            projectId: project.id,
            uploaderId: userId,
            fileName: body.name,
            mimeType: body.mimeType,
            sizeBytes: body.size,
            storageKey: body.url,
        },
        select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            storageKey: true,
            createdAt: true,
        },
    });

    await prisma.activityEvent.create({
        data: {
            projectId: project.id,
            actorId: userId,
            type: "FILE_UPLOADED",
            title: `File uploaded: ${body.name}`,
            description: null,
        },
    });

    return {
        id: created.id,
        name: created.fileName,
        mimeType: created.mimeType,
        size: created.sizeBytes,
        url: created.storageKey,
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

    await assertProjectAccessById(userId, approval.projectId);

    const newStatus =
        body.decision === "approved"
            ? "APPROVED"
            : body.decision === "changes-requested"
                ? "CHANGES_REQUESTED"
                : "CANCELLED";

    // Optimistic locking: callers send the `version` they observed; we only
    // update the row when the version still matches. Bumping `version` on
    // every write keeps concurrent UI sessions honest.
    const observedVersion =
        body.version ?? ((approval as unknown as { version?: number }).version ?? 0);

    const updated = await prisma.$transaction(async (tx) => {
        const updatedRow = await tx.approvalRequest.updateMany(
            {
                where: {
                    id: approval.id,
                    version: observedVersion,
                    status: "PENDING",
                },
                data: {
                    status: newStatus,
                    respondedAt: new Date(),
                    version: { increment: 1 },
                },
            } as unknown as Parameters<typeof tx.approvalRequest.updateMany>[0],
        );
        if (updatedRow.count === 0) {
            throw new AppError(
                status.CONFLICT,
                "This approval has changed since you opened it. Refresh and try again.",
                { code: "APPROVAL_STALE_VERSION" },
            );
        }
        await tx.approvalResponse.create({
            data: {
                approvalId: approval.id,
                responderId: userId,
                decision: newStatus,
                comment: body.note ?? null,
            },
        });
        await tx.activityEvent.create({
            data: {
                projectId: approval.projectId,
                actorId: userId,
                type: "PROJECT_UPDATED",
                title: `Approval ${body.decision}: ${approval.title}`,
                description: body.note ?? null,
            },
        });
        return updatedRow;
    });

    return {
        id: approval.id,
        status: mapApprovalStatus(newStatus),
        version: observedVersion + 1,
        respondedAt: new Date().toISOString(),
    };
};

const submitChangeRequest = async (
    userId: string,
    slug: string,
    body: ChangeRequestBody,
) => {
    const project = await findAccessibleProject(userId, slug);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    const impactUpper = body.impact.toUpperCase(); // "LOW" | "MEDIUM" | "HIGH"

    const created = await prisma.changeRequest.create({
        data: {
            projectId: project.id,
            title: body.title,
            description: body.description,
            impact: impactUpper,
            status: "PENDING",
        } as unknown as Parameters<typeof prisma.changeRequest.create>[0]["data"],
    });

    await prisma.activityEvent.create({
        data: {
            projectId: project.id,
            actorId: userId,
            type: "PROJECT_UPDATED",
            title: `Change request: ${body.title}`,
            description: `Impact: ${impactUpper.toLowerCase()}`,
        },
    });

    return {
        id: created.id,
        title: created.title,
        description: created.description,
        impact: impactUpper.toLowerCase() as "low" | "medium" | "high",
        status: mapChangeStatus(created.status),
        submittedByName: user?.name ?? "Unknown",
        submittedAt: created.createdAt.toISOString(),
        respondedAt: null,
        respondedByName: null,
        responseNote: null,
    };
};

export const projectDetailService = {
    getDetail,
    getActivity,
    postComment,
    uploadFile,
    respondToApproval,
    submitChangeRequest,
};