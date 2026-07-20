import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import { resolvePrimaryOrg, toWireTicketPriority, toWireTicketStatus } from "../portal.policy";
import { TicketPriority, TicketStatus } from "../../../../prisma/generated/prisma/enums";
import type { Prisma } from "../../../../prisma/generated/prisma/client";
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

    const where: Prisma.SupportTicketWhereInput = {
        organizationId: org.id,
    };

    const search = query.search ?? query.q;
    if (search) {
        where.AND = [
            {
                OR: [
                    { subject: { contains: search, mode: "insensitive" } },
                ],
            },
        ];
    }

    if (query.status) {
        const map: Record<string, TicketStatus[]> = {
            open: [TicketStatus.OPEN],
            pending: [TicketStatus.PENDING_CUSTOMER, TicketStatus.PENDING_STAFF],
            resolved: [TicketStatus.RESOLVED],
            closed: [TicketStatus.CLOSED],
        };
        where.status = { in: map[query.status] ?? [] };
    }

    if (query.priority) {
        const map: Record<string, TicketPriority[]> = {
            low: [TicketPriority.LOW],
            normal: [TicketPriority.NORMAL],
            high: [TicketPriority.HIGH],
            urgent: [TicketPriority.URGENT],
        };
        where.priority = { in: map[query.priority] ?? [] };
    }

    const [rows, total] = await Promise.all([
        prisma.supportTicket.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip: (query.page - 1) * query.perPage,
            take: query.perPage,
            select: {
                id: true,
                ticketNumber: true,
                subject: true,
                status: true,
                priority: true,
                updatedAt: true,
            },
        }),
        prisma.supportTicket.count({ where }),
    ]);

    const tickets: ITicketSummary[] = rows.map((t) => ({
        id: t.id,
        number: t.ticketNumber,
        subject: t.subject,
        status: toWireTicketStatus(t.status),
        priority: toWireTicketPriority(t.priority),
        lastUpdatedAt: t.updatedAt.toISOString(),
        unreadByCustomer: false,
        projectName: null,
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
            requesterId: userId,
            ticketNumber,
            subject: body.subject,
            priority: body.priority.toUpperCase() as
                | "LOW"
                | "NORMAL"
                | "HIGH"
                | "URGENT",
            status: "OPEN",
            projectId: body.projectId ?? null,
            category: "general",
        },
        select: {
            id: true,
            ticketNumber: true,
            priority: true,
            updatedAt: true,
        },
    });

    if (body.description) {
        await prisma.ticketMessage.create({
            data: {
                ticketId: created.id,
                authorId: userId,
                body: body.description,
                visibility: "CUSTOMER",
            },
        });
    }

    if (body.attachments?.length) {
        await prisma.ticketAttachment.createMany({
            data: body.attachments.map((a) => ({
                ticketId: created.id,
                uploaderId: userId,
                fileName: a.name,
                mimeType: a.mimeType ?? "application/octet-stream",
                sizeBytes: a.size ?? 0,
                storageKey: a.url,
            })),
        });
    }

    return {
        id: created.id,
        number: created.ticketNumber,
        subject: body.subject,
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
        select: {
            id: true,
            title: true,
            excerpt: true,
            category: true,
            slug: true,
            updatedAt: true,
        },
    });

    return {
        query: query.q,
        results: articles.map((a) => ({
            id: a.id,
            title: a.title,
            excerpt: a.excerpt ?? null,
            category: a.category,
            slug: a.slug,
            updatedAt: a.updatedAt.toISOString(),
        })),
    };
};

export const ticketsService = { list, create, searchHelp };