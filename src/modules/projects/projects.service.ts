import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import type {
    IProjectIndex,
    IProjectSummary,
    IProjectDetail,
    IDeliverable,
    IProjectTeamMember,
    IActivityEvent,
    ProjectStatus,
    DeliverableStatus,
} from "./projects.type";
import type { ProjectListQuery } from "./projects.validation";

/** Wire-format `ProjectStatus` ↔ DB enum `ProjectStatus`. */
const toWireStatus = (db: string): ProjectStatus => {
    if (db === "IN_PROGRESS") return "in-progress";
    return db.toLowerCase() as ProjectStatus;
};

/** Wire-format `DeliverableStatus` ↔ DB enum `DeliverableStatus`. */
const toWireDeliverableStatus = (db: string): DeliverableStatus => {
    if (db === "IN_PROGRESS") return "in-progress";
    return db.toLowerCase() as DeliverableStatus;
};

/** Wire-format `ProjectStatus` → DB enum. */
const fromWireProjectStatus = (wire: ProjectStatus): string =>
    wire === "in-progress" ? "IN_PROGRESS" : wire.toUpperCase();

/** Wire-format `DeliverableStatus` → DB enum. */
const fromWireDeliverableStatus = (wire: DeliverableStatus): string =>
    wire === "in-progress" ? "IN_PROGRESS" : wire.toUpperCase();

const toDateOnly = (d: Date | null | undefined): string | null =>
    d ? d.toISOString() : null;

const formatPackageLabel = (
    budgetAmount: { toString(): string } | number | null,
    currency: string | null,
): string | null => {
    if (budgetAmount === null) return null;
    const value = typeof budgetAmount === "number"
        ? budgetAmount
        : Number(budgetAmount.toString());
    if (!Number.isFinite(value)) return null;
    const symbol = currency === "USD" ? "$" : currency ? `${currency} ` : "";
    if (value >= 1000) return `${symbol}${Math.round(value / 1000)}k package`;
    return `${symbol}${Math.round(value)} package`;
};

const computeProgress = async (projectId: string): Promise<number | null> => {
    const [total, done] = await Promise.all([
        prisma.deliverable.count({ where: { projectId } }),
        prisma.deliverable.count({ where: { projectId, status: "COMPLETE" } }),
    ]);
    if (total === 0) return null;
    return Math.min(1, done / total);
};

const findNextMilestone = async (
    projectId: string,
): Promise<IProjectSummary["nextMilestone"]> => {
    const next = await prisma.deliverable.findFirst({
        where: { projectId, status: { in: ["PENDING", "IN_PROGRESS", "IN_REVIEW"] } },
        orderBy: [{ dueDate: "asc" }, { orderIndex: "asc" }],
        select: { title: true, dueDate: true },
    });
    if (!next) return null;
    return { title: next.title, dueAt: toDateOnly(next.dueDate) };
};

const toSummary = async (row: {
    id: string;
    slug: string;
    name: string;
    status: string;
    budgetAmount: unknown;
    budgetCurrency: string | null;
    updatedAt: Date;
    heroImageUrl: string | null;
}): Promise<IProjectSummary> => {
    const [progress, milestone] = await Promise.all([
        computeProgress(row.id),
        findNextMilestone(row.id),
    ]);
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: toWireStatus(row.status),
        package: formatPackageLabel(row.budgetAmount as { toString(): string }, row.budgetCurrency),
        progress,
        updatedAt: row.updatedAt.toISOString(),
        nextMilestone: milestone,
        coverImageUrl: row.heroImageUrl,
    };
};

const list = async (
    userId: string,
    query: ProjectListQuery,
): Promise<IProjectIndex> => {
    const where: Record<string, unknown> = {
        isDeleted: false,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };

    if (query.status && query.status !== "all") {
        where.status = fromWireProjectStatus(query.status);
    }

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

    const page = query.page ?? 1;
    const perPage = query.perPage ?? 12;

    const [rows, total] = await Promise.all([
        prisma.project.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip: (page - 1) * perPage,
            take: perPage,
            select: {
                id: true,
                slug: true,
                name: true,
                status: true,
                budgetAmount: true,
                budgetCurrency: true,
                updatedAt: true,
                heroImageUrl: true,
            },
        }),
        prisma.project.count({ where }),
    ]);

    const summaries = await Promise.all(rows.map(toSummary));

    // Roll-up of statuses present in the full result set (capped at 7 enum values).
    const allStatuses = new Set<ProjectStatus>();
    summaries.forEach((s) => allStatuses.add(s.status));

    return {
        projects: summaries,
        statuses: Array.from(allStatuses).sort(),
        total,
        page,
        perPage,
    };
};

const getBySlug = async (userId: string, slug: string): Promise<IProjectDetail> => {
    const project = await prisma.project.findFirst({
        where: {
            slug,
            isDeleted: false,
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            description: true,
            tagline: true,
            heroImageUrl: true,
            budgetAmount: true,
            budgetCurrency: true,
            startDate: true,
            targetEndDate: true,
            completedAt: true,
            updatedAt: true,
            members: {
                select: {
                    role: true,
                    joinedAt: true,
                    user: {
                        select: { id: true, name: true, image: true, jobTitle: true },
                    },
                },
                orderBy: { joinedAt: "asc" },
            },
            deliverables: {
                select: {
                    id: true,
                    title: true,
                    description: true,
                    status: true,
                    dueDate: true,
                    orderIndex: true,
                },
                orderBy: [{ orderIndex: "asc" }, { dueDate: "asc" }],
            },
            activity: {
                select: {
                    id: true,
                    title: true,
                    description: true,
                    createdAt: true,
                    actor: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            },
        },
    });

    if (!project) {
        throw new AppError(status.NOT_FOUND, "Project not found.");
    }

    const [progress, milestone] = await Promise.all([
        computeProgress(project.id),
        findNextMilestone(project.id),
    ]);

    const team: IProjectTeamMember[] = project.members.map((m) => ({
        name: m.user.name,
        role: humanRoleLabel(m.role),
        avatarUrl: m.user.image,
    }));

    const deliverables: IDeliverable[] = project.deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description ?? undefined,
        status: toWireDeliverableStatus(d.status),
        dueAt: toDateOnly(d.dueDate),
    }));

    const activity: IActivityEvent[] = project.activity.map((a) => ({
        id: a.id,
        at: a.createdAt.toISOString(),
        title: a.title,
        description: a.description ?? null,
        href: `/account/projects/${project.slug}#activity-${a.id}`,
    }));

    return {
        id: project.id,
        slug: project.slug,
        name: project.name,
        status: toWireStatus(project.status),
        package: formatPackageLabel(project.budgetAmount as { toString(): string }, project.budgetCurrency),
        progress,
        updatedAt: project.updatedAt.toISOString(),
        nextMilestone: milestone,
        coverImageUrl: project.heroImageUrl,
        description: project.description ?? project.tagline ?? "",
        startDate: toDateOnly(project.startDate),
        launchDate: toDateOnly(project.completedAt ?? project.targetEndDate),
        team,
        deliverables,
        activity,
    };
};

/** Convert AccountRole → human label for the team section. */
const humanRoleLabel = (role: string): string => {
    switch (role) {
        case "OWNER": return "Owner";
        case "ADMIN": return "Lead";
        case "EDITOR": return "Editor";
        case "VIEWER": return "Reviewer";
        default: return role.toLowerCase();
    }
};

export const projectsService = { list, getBySlug };
