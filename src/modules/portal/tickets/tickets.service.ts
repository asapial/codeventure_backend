import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import { resolvePrimaryOrg, toWireTicketPriority, toWireTicketStatus } from "../portal.policy";
import type {
    ICustomerTicketIndex,
    IHelpSearchResult,
    ITicketSummary,
} from "./tickets.type";
import type {
    CreateTicketBody,
    HelpSearchQuery,
    TicketListQuery,
} from "./tickets.validation";

const list = async (
    userId: string,
    query: TicketListQuery,
): Promise<ICustomerTicketIndex> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        return {
            tickets: [],
            page: query.page,
            perPage: query.perPage,
            total: 0,
            filters: { statuses: [], priorities: [] },
        };
    }

    const where: Record<string, unknown> = {
        organizationId: org.id,
        isDeleted: false,
    };

    const search = query.search ?? query.q;
    if (search) {
        where.OR = [
            { subject: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
        ];
    }

    if (query.status) {
        const map: Record<string, string[]> = {
            open: ["OPEN"],
            pending: ["PENDING"],
            "on-hold": ["ON_HOLD"],
            resolved: ["RESOLVED"],
            closed: ["CLOSED"],
        };
        where.status = { in: map[query.status] ?? [] };
    }

    if (query.priority) {
        const map: Record<string, string[]> = {
            low: ["LOW"],
            normal: ["NORMAL"],
            high: ["HIGH"],
            urgent: ["URGENT"],
        };
        where.priority = { in: map[query.priority] ?? [] };
    }

    const [rows, total] = await Promise.all([
        prisma.supportTicket.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip: (query.page - 1) * query.perPage,
            take: query.perPage,
            include: {
                project: { select: { name: true } },
            },
        }),
        prisma.supportTicket.count({ where }),
    ]);

    const tickets: ITicketSummary[] = rows.map((t) => ({
        id: t.id,
        number: t.number,
        subject: t.subject,
        status: toWireTicketStatus(t.status),
        priority: toWireTicketPriority(t.priority),
        lastUpdatedAt: t.updatedAt.toISOString(),
        unreadByCustomer: t.unreadByCustomer,
        projectName: t.project?.name ?? null,
    }));

    const statusSet = new Set(tickets.map((t) => t.status));
    const prioritySet = new Set(tickets.map((t) => t.priority));

    return {
        tickets,
        page: query.page,
        perPage: query.perPage,
        total,
        filters: {
            statuses: Array.from(statusSet).sort(),
            priorities: Array.from(prioritySet).sort(),
        },
    };
};

const create = async (
    userId: string,
    body: CreateTicketBody,
): Promise<ITicketSummary> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(status.FORBIDDEN, "No organization.", {
            code: "NO_ORG",
        });
    }

    const ticketNumber = `T-${Date.now().toString(36).toUpperCase()}`;

    const created = await prisma.supportTicket.create({
        data: {
            organizationId: org.id,
            submittedById: userId,
            number: ticketNumber,
            subject: body.subject,
            description: body.description,
            priority: body.priority.toUpperCase(),
            status: "OPEN",
            unreadByCustomer: false,
            projectId: body.projectId ?? null,
        },
    });

    if (body.attachments?.length) {
        await prisma.ticketAttachment.createMany({
            data: body.attachments.map((a) => ({
                ticketId: created.id,
                uploaderId: userId,
                name: a.name,
                mimeType: a.mimeType ?? null,
                size: a.size ?? null,
                url: a.url,
            })),
        });
    }

    return {
        id: created.id,
        number: created.number,
        subject: created.subject,
        status: "open",
        priority: toWireTicketPriority(created.priority),
        lastUpdatedAt: created.updatedAt.toISOString(),
        unreadByCustomer: false,
        projectName: null,
    };
};

const searchHelp = async (
    _userId: string,
    query: HelpSearchQuery,
): Promise<IHelpSearchResult> => {
    const articles = await prisma.helpArticle.findMany({
        where: {
            OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { body: { contains: query.q, mode: "insensitive" } },
            ],
        },
        orderBy: { updatedAt: "desc" },
        take: query.limit,
    });

    return {
        query: query.q,
        results: articles.map((a) => ({
            id: a.id,
            title: a.title,
            excerpt: a.excerpt,
            category: a.category,
            slug: a.slug,
            updatedAt: a.updatedAt.toISOString(),
        })),
    };
};

export const ticketsService = { list, create, searchHelp };