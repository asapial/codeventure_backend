import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    resolvePrimaryOrg,
    toWireTicketPriority,
    toWireTicketStatus,
} from "../portal.policy";
import type {
    ITicketDetail,
    ITicketMessage,
    MessageVisibilityWire,
} from "./ticket-detail.type";
import type { PatchTicketBody, PostMessageBody } from "./ticket-detail.validation";

const findTicketForUser = async (userId: string, ticketId: string) => {
    const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: {
            id: true,
            organizationId: true,
            requesterId: true,
            project: { select: { name: true } },
        },
    });
    if (!ticket) {
        throw new AppError(status.NOT_FOUND, "Ticket not found.", {
            code: "TICKET_NOT_FOUND",
        });
    }
    // Authorization: caller must belong to the ticket's org.
    const org = await resolvePrimaryOrg(userId);
    if (!org || org.id !== ticket.organizationId) {
        throw new AppError(status.FORBIDDEN, "Ticket not visible.", {
            code: "TICKET_FORBIDDEN",
        });
    }
    return ticket;
};

const mapVisibility = (raw: string): MessageVisibilityWire => {
    if (raw === "INTERNAL") return "internal";
    return "customer";
};

const getDetail = async (
    userId: string,
    ticketId: string,
): Promise<ITicketDetail> => {
    const ticket = await findTicketForUser(userId, ticketId);

    const [fullTicket, messages, attachments, submitter] = await Promise.all([
        prisma.supportTicket.findUnique({
            where: { id: ticketId },
            select: {
                ticketNumber: true,
                subject: true,
                status: true,
                priority: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma.ticketMessage.findMany({
            where: {
                ticketId,
                visibility: { in: ["CUSTOMER"] },
            },
            orderBy: { createdAt: "asc" },
            include: {
                author: { select: { id: true, name: true, image: true } },
            },
        }),
        prisma.ticketAttachment.findMany({
            where: { ticketId },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                fileName: true,
                mimeType: true,
                sizeBytes: true,
                storageKey: true,
            },
        }),
        prisma.user.findUnique({
            where: { id: ticket.requesterId },
            select: { name: true },
        }),
    ]);

    if (!fullTicket) {
        throw new AppError(status.NOT_FOUND, "Ticket not found.", {
            code: "TICKET_NOT_FOUND",
        });
    }

    const wireMessages: ITicketMessage[] = messages.map((m) => {
        const isStaff = m.authorId !== ticket.requesterId;
        return {
            id: m.id,
            body: m.body,
            visibility: mapVisibility(m.visibility),
            senderName: isStaff ? "Support team" : m.author.name,
            senderRole: isStaff ? "agent" : "customer",
            senderAvatarUrl: m.author.image ?? null,
            createdAt: m.createdAt.toISOString(),
            attachments: attachments
                .filter((a) => true) // attachments are ticket-level in this schema
                .slice(0, 0), // empty per-message — wire shape compatibility
        };
    });

    return {
        id: ticket.id,
        number: fullTicket.ticketNumber,
        subject: fullTicket.subject,
        description: null,
        status: toWireTicketStatus(fullTicket.status),
        priority: toWireTicketPriority(fullTicket.priority),
        projectName: ticket.project?.name ?? null,
        submittedByName: submitter?.name ?? "Unknown",
        submittedAt: fullTicket.createdAt.toISOString(),
        lastUpdatedAt: fullTicket.updatedAt.toISOString(),
        messages: wireMessages,
        attachments: attachments.map((a) => ({
            id: a.id,
            name: a.fileName,
            mimeType: a.mimeType,
            size: a.sizeBytes,
            url: a.storageKey,
        })),
    };
};

const postMessage = async (
    userId: string,
    ticketId: string,
    body: PostMessageBody,
): Promise<ITicketMessage> => {
    const ticket = await findTicketForUser(userId, ticketId);

    const visibilityEnum =
        body.visibility === "internal" ? "INTERNAL" : "CUSTOMER";

    const created = await prisma.ticketMessage.create({
        data: {
            ticketId,
            authorId: userId,
            body: body.body,
            visibility: visibilityEnum,
        },
        select: {
            id: true,
            body: true,
            visibility: true,
            createdAt: true,
        },
    });

    if (body.attachments?.length) {
        await prisma.ticketAttachment.createMany({
            data: body.attachments.map((a) => ({
                ticketId,
                uploaderId: userId,
                fileName: a.name,
                mimeType: a.mimeType ?? "application/octet-stream",
                sizeBytes: a.size ?? 0,
                storageKey: a.url,
            })),
        });
    }

    await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
    });

    return {
        id: created.id,
        body: created.body,
        visibility: mapVisibility(created.visibility),
        senderName: "You",
        senderRole: "customer",
        senderAvatarUrl: null,
        createdAt: created.createdAt.toISOString(),
        attachments: [],
    };
};

const patch = async (
    userId: string,
    ticketId: string,
    body: PatchTicketBody,
): Promise<{ id: string; status: string; updatedAt: string }> => {
    const ticket = await findTicketForUser(userId, ticketId);
    const newStatus = body.action === "close" ? "CLOSED" : "OPEN";

    const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
            status: newStatus,
            updatedAt: new Date(),
            ...(body.note
                ? {
                      messages: {
                          create: {
                              authorId: userId,
                              body: `Customer ${body.action}d ticket${
                                  body.note ? `: ${body.note}` : ""
                              }`,
                              visibility: "INTERNAL",
                          },
                      },
                  }
                : {}),
        },
        select: { id: true, status: true, updatedAt: true },
    });

    return {
        id: updated.id,
        status: toWireTicketStatus(updated.status),
        updatedAt: updated.updatedAt.toISOString(),
    };
};

export const ticketDetailService = { getDetail, postMessage, patch };