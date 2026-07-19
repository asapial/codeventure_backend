import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    resolvePrimaryOrg,
    toIso,
    toWireProjectStatus,
} from "../portal.policy";
import type { ICustomerProjectIndex, ICustomerProjectSummary } from "./projects.type";
import type { ProjectListQuery } from "./projects.validation";

/** Map our phase enum onto the project's `status` column (rough but useful). */
const derivePhase = (
    status: string,
): ICustomerProjectSummary["phase"] => {
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
    nextDueAt: Date | null,
): ICustomerProjectSummary["health"] => {
    if (!nextDueAt) return "on-track";
    const due = nextDueAt.getTime();
    if (due < Date.now()) return "at-risk";
    return "on-track";
};

const list = async (
    userId: string,
    query: ProjectListQuery,
): Promise<ICustomerProjectIndex> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        return { projects: [], phases: [], page: query.page, perPage: query.perPage, total: 0 };
    }

    const where: Record<string, unknown> = {
        organizationId: org.id,
        isDeleted: false,
    };

    if (query.search) {
        const search = query.search.trim();
        where.AND = [
            {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { tagline: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ],
            },
        ];
    }

    if (query.phase) {
        const map: Record<string, string[]> = {
            discovery: ["DRAFT", "PLANNING"],
            design: ["PLANNING"],
            build: ["IN_PROGRESS"],
            review: ["IN_REVIEW"],
            launch: ["LAUNCHED"],
            maintenance: ["PAUSED"],
        };
        where.status = { in: map[query.phase] ?? [] };
    }

    if (query.health) {
        // Health is derived; we approximate via deliverables for filtering.
        const blockedProjects = await prisma.project.findMany({
            where: {
                organizationId: org.id,
                isDeleted: false,
                status: "BLOCKED",
            },
            select: { id: true },
        });
        const blockedIds = blockedProjects.map((p) => p.id);

        if (query.health === "blocked") {
            where.id = { in: blockedIds };
        } else if (query.health === "at-risk") {
            where.milestones = {
                some: { completedAt: null, dueAt: { lt: new Date() } },
            };
        }
    }

    const [rows, total] = await Promise.all([
        prisma.project.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip: (query.page - 1) * query.perPage,
            take: query.perPage,
            select: {
                id: true,
                slug: true,
                name: true,
                tagline: true,
                status: true,
                heroImageUrl: true,
                updatedAt: true,
                milestones: {
                    where: { completedAt: null },
                    orderBy: [{ dueAt: "asc" }, { orderIndex: "asc" }],
                    take: 1,
                    select: { title: true, dueAt: true },
                },
                deliverables: { select: { id: true, status: true } },
            },
        }),
        prisma.project.count({ where }),
    ]);

    const summaries: ICustomerProjectSummary[] = rows.map((row) => {
        const nextMilestone = row.milestones[0] ?? null;
        const total = row.deliverables.length;
        const done = row.deliverables.filter((d) => d.status === "COMPLETE").length;
        const progress = total === 0 ? null : Math.min(1, done / total);
        return {
            id: row.id,
            slug: row.slug,
            name: row.name,
            tagline: row.tagline,
            status: toWireProjectStatus(row.status),
            phase: derivePhase(row.status),
            health: deriveHealth(nextMilestone?.dueAt ?? null),
            progress,
            coverImageUrl: row.heroImageUrl,
            updatedAt: row.updatedAt.toISOString(),
            nextMilestone: nextMilestone
                ? { title: nextMilestone.title, dueAt: toIso(nextMilestone.dueAt) }
                : null,
        };
    });

    const phasesSet = new Set(summaries.map((s) => s.phase));
    return {
        projects: summaries,
        phases: Array.from(phasesSet).sort(),
        page: query.page,
        perPage: query.perPage,
        total,
    };
};

void AppError; // imported for future use; suppress lint.

export const projectsService = { list };