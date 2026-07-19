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
    SenderRoleWire,
} from "./ticket-detail.type";
import type { PatchTicketBody, PostMessageBody } from "./ticket-detail.validation";

const findTicketForUser = async (userId: string, ticketId: string) => {
    const ticket = await prisma.supportTicket.findFirst({
        where: { id: ticketId, isDeleted: false },
        include: {
            organization: { select: { id: true } },
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
    if (raw === "ALL") return "all";
    if (raw === "INTERNAL") return "internal";
    return "customer";
};

const mapSenderRole = (raw: string): SenderRoleWire => {
    switch (raw) {
        case "AGENT":
            return "agent";
        case "SYSTEM":
            return "system";
        default:
            return "customer";
    }
};

const getDetail = async (
    userId: string,
    ticketId: string,
): Promise<ITicketDetail> => {
    const ticket = await findTicketForUser(userId, ticketId);

    const [messages, attachments, submitter] = await Promise.all([
        prisma.ticketMessage.findMany({
            where: { ticketId, visibility: { in: ["ALL", "CUSTOMER"] } },
            orderBy: { createdAt: "asc" },
            include: {
                attachments: true,
                sender: {
                    select: { name: true, avatarUrl: true },
                },
            },
        }),
        prisma.ticketAttachment.findMany({
            where: { ticketId, messageId: null },
            orderBy: { createdAt: "asc" },
        }),
        prisma.user.findUnique({
            where: { id: ticket.submittedById },
            select: { name: true },
        }),
    ]);

    const wireMessages: ITicketMessage[] = messages.map((m) => ({
        id: m.id,
        body: m.body,
        visibility: mapVisibility(m.visibility),
        senderName: m.sender?.name ?? "System",
        senderRole: mapSenderRole(m.senderRole),
        senderAvatarUrl: m.sender?.avatarUrl ?? null,
        createdAt: m.createdAt.toISOString(),
        attachments: m.attachments.map((a) => ({
            id: a.id,
            name: a.name,
            mimeType: a.mimeType,
            size: a.size,
            url: a.url,
        })),
    }));

    // Mark as read for the customer.
    await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { unreadByCustomer: false },
    });

    return {
        id: ticket.id,
        number: ticket.number,
        subject: ticket.subject,
        description: ticket.description,
        status: toWireTicketStatus(ticket.status),
        priority: toWireTicketPriority(ticket.priority),
        projectName: ticket.project?.name ?? null,
        submittedByName: submitter?.name ?? "Unknown",
        submittedAt: ticket.createdAt.toISOString(),
        lastUpdatedAt: ticket.updatedAt.toISOString(),
        messages: wireMessages,
        attachments: attachments.map((a) => ({
            id: a.id,
            name: a.name,
            mimeType: a.mimeType,
            size: a.size,
            url: a.url,
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
        body.visibility === "all"
            ? "ALL"
            : body.visibility === "internal"
                ? "INTERNAL"
                : "CUSTOMER";

    const created = await prisma.ticketMessage.create({
        data: {
            ticketId,
            senderId: userId,
            senderRole: "CUSTOMER",
            body: body.body,
            visibility: visibilityEnum,
        },
    });

    if (body.attachments?.length) {
        await prisma.ticketAttachment.createMany({
            data: body.attachments.map((a) => ({
                ticketId,
                messageId: created.id,
                uploaderId: userId,
                name: a.name,
                mimeType: a.mimeType ?? null,
                size: a.size ?? null,
                url: a.url,
            })),
        });
    }

    await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date(), unreadByCustomer: false },
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
                              senderId: userId,
                              senderRole: "SYSTEM",
                              body: `Customer ${body.action}d ticket${
                                  body.note ? `: ${body.note}` : ""
                              }`,
                              visibility: "ALL",
                          },
                      },
                  }
                : {}),
        },
    });

    return {
        id: updated.id,
        status: toWireTicketStatus(updated.status),
        updatedAt: updated.updatedAt.toISOString(),
    };
};

export const ticketDetailService = { getDetail, postMessage, patch };