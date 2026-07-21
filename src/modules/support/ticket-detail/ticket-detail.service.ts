/**
 * S3 — Staff Ticket Workspace service.
 *
 * The workspace has one read endpoint that fans out into messages + notes +
 * assignments + escalations + macros + SLA clock. All seven staff mutations
 * go through here too (postMessage / postNote / applyMacro / escalate /
 * resolve / reopen / patch). Mutations always write an AuditLog row.
 */

import status from "http-status";

import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    type SlaPolicyShape,
    computeSlaClock,
    recordAuditEvent,
    requireSupportAgent,
    requireTicketAccess,
    toIso,
    toWireNoteVisibility,
    toWireResolutionCode,
    toWireSlaSeverity,
    toWireSentiment,
    toWireTicketPriority,
    toWireTicketStatus,
} from "../support.policy";
import type { ApplyMacroBody, EscalateBody, PatchTicketBody, PostMessageBody, PostNoteBody, ReopenBody, ResolveBody } from "./ticket-detail.validation";
import type {
    IEscalateResult,
    IEscalationRow,
    IPatchResult,
    IPostMessageResult,
    IResolveResult,
    ITicketAssignee,
    ITicketAttachment,
    ITicketDetail,
    ITicketMacro,
    ITicketSlaClock,
    IWorkspaceMessage,
} from "./ticket-detail.type";

const DEFAULT_POLICY: SlaPolicyShape = {
    firstResponseMinutes: 240,
    resolutionMinutes: 1440,
};

// ─────────────────────────────────────────────────────────────────────────────
// Read — full workspace
// ─────────────────────────────────────────────────────────────────────────────

const getDetail = async (
    actorUserId: string,
    ticketId: string,
): Promise<ITicketDetail> => {
    const agent = await requireSupportAgent(actorUserId);
    const stub = await requireTicketAccess(ticketId);

    const [ticket, messages, internalNotes, attachments, assignments, escalations, macros, policy] = await Promise.all([
        prisma.supportTicket.findUnique({
            where: { id: ticketId },
            select: {
                id: true,
                ticketNumber: true,
                subject: true,
                category: true,
                status: true,
                priority: true,
                sentiment: true,
                organizationId: true,
                requesterId: true,
                createdAt: true,
                updatedAt: true,
                resolvedAt: true,
                slaDueAt: true,
                organization: { select: { id: true, name: true } },
                requester: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                },
            },
        }),
        prisma.ticketMessage.findMany({
            where: { ticketId },
            orderBy: { createdAt: "asc" },
            include: {
                author: {
                    select: { id: true, name: true, email: true, image: true, role: true },
                },
            },
        }),
        prisma.internalNote.findMany({
            where: { ticketId },
            orderBy: { createdAt: "asc" },
            include: {
                author: {
                    select: { id: true, name: true, email: true, image: true, role: true },
                },
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
        prisma.supportAssignment.findMany({
            where: { ticketId },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                agent: { select: { id: true, name: true, email: true } },
                assignedBy: { select: { name: true, email: true } },
                reason: true,
                isCurrent: true,
                createdAt: true,
            },
        }),
        prisma.escalationEvent.findMany({
            where: { ticketId },
            orderBy: { createdAt: "desc" },
            include: {
                triggeredBy: { select: { name: true, email: true } },
            },
        }),
        prisma.cannedResponse.findMany({
            where: { archived: false },
            orderBy: [{ usageCount: "desc" }, { title: "asc" }],
            take: 25,
            select: {
                id: true,
                title: true,
                shortcut: true,
                body: true,
                category: true,
                usageCount: true,
            },
        }),
        prisma.slaPolicy.findFirst({
            where: { organizationId: stub.organizationId },
            orderBy: { createdAt: "desc" },
            select: {
                name: true,
                firstResponseMinutes: true,
                resolutionMinutes: true,
            },
        }),
    ]);

    if (!ticket) {
        throw new AppError(status.NOT_FOUND, "Ticket not found.", {
            code: "TICKET_NOT_FOUND",
        });
    }

    const now = new Date();
    const policyShape: SlaPolicyShape = policy ?? DEFAULT_POLICY;
    const clock = computeSlaClock(ticket.createdAt, null, policyShape, now);

    const slaClock: ITicketSlaClock = {
        firstResponseState: clock.firstResponseState,
        resolutionState: clock.resolutionState,
        minutesSinceOpen: clock.minutesSinceOpen,
        minutesToFirstResponseDue: clock.minutesToFirstResponseDue,
        minutesToResolutionDue: clock.minutesToResolutionDue,
        percentElapsedFirst: clock.percentElapsedFirst,
        percentElapsedResolution: clock.percentElapsedResolution,
        policyName: policy?.name ?? null,
    };

    const thread: IWorkspaceMessage[] = [];

    const requesterId = ticket.requesterId;

    for (const m of messages) {
        thread.push({
            id: m.id,
            kind: m.visibility === "INTERNAL" ? "internal-note" : "customer-message",
            body: m.body,
            visibility:
                m.visibility === "INTERNAL"
                    ? toWireNoteVisibility("INTERNAL_TEAM")
                    : toWireTicketStatus(ticket.status),
            author: {
                id: m.author.id,
                name: m.author.name ?? null,
                email: m.author.email,
                avatarUrl: m.author.image ?? null,
                isStaff: m.authorId !== requesterId,
            },
            createdAt: toIso(m.createdAt) ?? "",
            pinned: false,
        });
    }
    for (const n of internalNotes) {
        thread.push({
            id: n.id,
            kind: "internal-note",
            body: n.body,
            visibility: toWireNoteVisibility(n.visibility),
            author: {
                id: n.author.id,
                name: n.author.name ?? null,
                email: n.author.email,
                avatarUrl: n.author.image ?? null,
                isStaff: true,
            },
            createdAt: toIso(n.createdAt) ?? "",
            pinned: n.pinned,
        });
    }
    thread.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    const wireAssignments: ITicketAssignee[] = assignments.map((a) => ({
        id: a.agent.id,
        name: a.agent.name ?? null,
        email: a.agent.email,
        assignedAt: toIso(a.createdAt) ?? "",
        reason: a.reason ?? null,
        assignedByName: a.assignedBy?.name ?? a.assignedBy?.email ?? null,
    }));
    const currentAssignment =
        assignments.find((a) => a.isCurrent) ?? assignments[assignments.length - 1] ?? null;
    const currentAssignee: ITicketAssignee | null = currentAssignment
        ? {
            id: currentAssignment.agent.id,
            name: currentAssignment.agent.name ?? null,
            email: currentAssignment.agent.email,
            assignedAt: toIso(currentAssignment.createdAt) ?? "",
            reason: currentAssignment.reason ?? null,
            assignedByName:
                currentAssignment.assignedBy?.name ??
                currentAssignment.assignedBy?.email ??
                null,
        }
        : null;

    const wireEscalations: IEscalationRow[] = escalations.map((row) => ({
        id: row.id,
        severity: toWireSlaSeverity(row.severity),
        fromPriority: toWireTicketPriority(row.fromPriority),
        toPriority: toWireTicketPriority(row.toPriority),
        reason: row.reason,
        etaMinutes: row.etaMinutes ?? null,
        triggeredByName: row.triggeredBy?.name ?? row.triggeredBy?.email ?? null,
        createdAt: toIso(row.createdAt) ?? "",
    }));

    const wireAttachments: ITicketAttachment[] = attachments.map((a) => ({
        id: a.id,
        name: a.fileName,
        mimeType: a.mimeType ?? null,
        size: a.sizeBytes ?? null,
        url: a.storageKey,
    }));

    const wireMacros: ITicketMacro[] = macros.map((m) => ({
        id: m.id,
        title: m.title,
        shortcut: m.shortcut,
        body: m.body,
        category: m.category ?? null,
        usageCount: m.usageCount,
    }));

    return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: null,
        category: ticket.category,
        status: toWireTicketStatus(ticket.status),
        priority: toWireTicketPriority(ticket.priority),
        sentiment: toWireSentiment(ticket.sentiment),
        organization: {
            id: ticket.organization.id,
            name: ticket.organization.name,
        },
        requester: {
            id: ticket.requester.id,
            name: ticket.requester.name ?? null,
            email: ticket.requester.email,
            avatarUrl: ticket.requester.image ?? null,
            isStaff: false,
        },
        currentAssignee,
        assignmentHistory: wireAssignments,
        slaClock,
        createdAt: toIso(ticket.createdAt) ?? "",
        updatedAt: toIso(ticket.updatedAt) ?? "",
        resolvedAt: toIso(ticket.resolvedAt),
        slaDueAt: toIso(ticket.slaDueAt),
        thread,
        attachments: wireAttachments,
        macros: wireMacros,
        escalations: wireEscalations,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

const postMessage = async (
    actorUserId: string,
    ticketId: string,
    body: PostMessageBody,
): Promise<IPostMessageResult> => {
    const agent = await requireSupportAgent(actorUserId);
    const ticket = await requireTicketAccess(ticketId);

    const visibilityEnum = body.visibility === "internal" ? "INTERNAL" : "CUSTOMER";

    const created = await prisma.ticketMessage.create({
        data: {
            ticketId: ticket.id,
            authorId: agent.id,
            body: body.body,
            visibility: visibilityEnum,
        },
        select: { id: true, createdAt: true },
    });

    await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
    });

    await recordAuditEvent({
        actorId: agent.id,
        kind: "MESSAGE_POSTED",
        targetRef: `ticketMessage:${created.id}`,
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        afterJson: { visibility: visibilityEnum, length: body.body.length },
    });

    return {
        messageId: created.id,
        createdAt: toIso(created.createdAt) ?? "",
    };
};

const postNote = async (
    actorUserId: string,
    ticketId: string,
    body: PostNoteBody,
): Promise<IPostMessageResult> => {
    const agent = await requireSupportAgent(actorUserId);
    const ticket = await requireTicketAccess(ticketId);

    const visibilityEnum: NoteVisibilityEnum =
        body.visibility === "leadership"
            ? "LEADERSHIP"
            : body.visibility === "private"
            ? "PRIVATE"
            : "INTERNAL_TEAM";

    const created = await prisma.internalNote.create({
        data: {
            ticketId: ticket.id,
            authorId: agent.id,
            body: body.body,
            visibility: visibilityEnum,
            pinned: body.pinned ?? false,
        },
        select: { id: true, createdAt: true },
    });

    await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
    });

    await recordAuditEvent({
        actorId: agent.id,
        kind: "INTERNAL_NOTE_ADDED",
        targetRef: `internalNote:${created.id}`,
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        afterJson: { visibility: visibilityEnum, pinned: body.pinned ?? false },
    });

    return {
        messageId: created.id,
        createdAt: toIso(created.createdAt) ?? "",
    };
};

const applyMacro = async (
    actorUserId: string,
    ticketId: string,
    body: ApplyMacroBody,
): Promise<IPostMessageResult> => {
    const agent = await requireSupportAgent(actorUserId);
    const ticket = await requireTicketAccess(ticketId);

    const macro = await prisma.cannedResponse.findUnique({
        where: { id: body.macroId },
        select: { id: true, body: true, archived: true },
    });
    if (!macro || macro.archived) {
        throw new AppError(status.NOT_FOUND, "Macro not found or archived.", {
            code: "MACRO_NOT_FOUND",
        });
    }

    // Macros always post as customer-visible messages — staff pick
    // "internal note" instead when they want staff-only.
    const created = await prisma.ticketMessage.create({
        data: {
            ticketId: ticket.id,
            authorId: agent.id,
            body: macro.body,
            visibility: "CUSTOMER",
        },
        select: { id: true, createdAt: true },
    });

    // Bump usage counter + ticket updatedAt + audit event.
    await Promise.all([
        prisma.cannedResponse.update({
            where: { id: macro.id },
            data: { usageCount: { increment: 1 } },
        }),
        prisma.supportTicket.update({
            where: { id: ticket.id },
            data: { updatedAt: new Date() },
        }),
    ]);

    await recordAuditEvent({
        actorId: agent.id,
        kind: "MACRO_APPLIED",
        targetRef: `cannedResponse:${macro.id}`,
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        afterJson: { macroId: macro.id },
    });

    return {
        messageId: created.id,
        createdAt: toIso(created.createdAt) ?? "",
    };
};

const escalate = async (
    actorUserId: string,
    ticketId: string,
    body: EscalateBody,
): Promise<IEscalateResult> => {
    const agent = await requireSupportAgent(actorUserId);
    const ticket = await requireTicketAccess(ticketId);

    const severityEnum: SlaSeverityEnum =
        body.severity === "critical"
            ? "CRITICAL"
            : body.severity === "low"
            ? "LOW"
            : body.severity === "high"
            ? "HIGH"
            : "NORMAL";

    const previousPriority: TicketPriorityEnum = (
        await prisma.supportTicket.findUnique({
            where: { id: ticket.id },
            select: { priority: true },
        })
    )?.priority ?? "NORMAL";

    const escalation = await prisma.$transaction(async (tx) => {
        const event = await tx.escalationEvent.create({
            data: {
                ticketId: ticket.id,
                triggeredById: agent.id,
                fromPriority: previousPriority,
                toPriority: "URGENT",
                reason: body.reason,
                severity: severityEnum,
                etaMinutes: body.etaMinutes ?? null,
            },
            select: { id: true, createdAt: true },
        });
        await tx.supportTicket.update({
            where: { id: ticket.id },
            data: { priority: "URGENT", updatedAt: new Date() },
        });
        return event;
    });

    await recordAuditEvent({
        actorId: agent.id,
        kind: "TICKET_ESCALATED",
        targetRef: `escalationEvent:${escalation.id}`,
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        afterJson: {
            from: previousPriority,
            to: "URGENT",
            reason: body.reason,
            severity: severityEnum,
            etaMinutes: body.etaMinutes ?? null,
        },
    });

    return {
        id: ticket.id,
        escalationId: escalation.id,
        priority: "urgent",
        severity: body.severity,
        createdAt: toIso(escalation.createdAt) ?? "",
    };
};

const resolve = async (
    actorUserId: string,
    ticketId: string,
    body: ResolveBody,
): Promise<IResolveResult> => {
    const agent = await requireSupportAgent(actorUserId);
    const ticket = await requireTicketAccess(ticketId);

    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
        throw new AppError(status.CONFLICT, "Ticket is already resolved.", {
            code: "TICKET_NOT_RESOLVABLE",
        });
    }

    const resolutionEnum: ResolutionCodeEnum =
        body.resolution === "fixed"
            ? "FIXED"
            : body.resolution === "workaround"
            ? "WORKAROUND"
            : body.resolution === "duplicate"
            ? "DUPLICATE"
            : body.resolution === "wont-fix"
            ? "WONT_FIX"
            : body.resolution === "customer-responded"
            ? "CUSTOMER_RESPONDED"
            : body.resolution === "escalated-to-engineering"
            ? "ESCALATED_TO_ENGINEERING"
            : body.resolution === "billing-adjustment"
            ? "BILLING_ADJUSTMENT"
            : "OTHER";

    const now = new Date();

    const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
            status: "RESOLVED",
            resolvedAt: now,
            updatedAt: now,
        },
        select: { id: true, status: true },
    });

    // Persist the resolution code on a follow-up message so the thread
    // preserves the conversation context.
    if (body.note) {
        await prisma.ticketMessage.create({
            data: {
                ticketId: ticket.id,
                authorId: agent.id,
                body: body.note,
                visibility: "INTERNAL",
            },
        });
    }

    await recordAuditEvent({
        actorId: agent.id,
        kind: "TICKET_RESOLVED",
        targetRef: `supportTicket:${ticket.id}`,
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        afterJson: { resolution: resolutionEnum, note: body.note ?? null },
    });

    return {
        id: updated.id,
        status: "resolved",
        resolutionCode: body.resolution,
        resolvedAt: now.toISOString(),
    };
};

const reopen = async (
    actorUserId: string,
    ticketId: string,
    body: ReopenBody | undefined,
): Promise<IPatchResult> => {
    const agent = await requireSupportAgent(actorUserId);
    const ticket = await requireTicketAccess(ticketId);

    if (ticket.status === "OPEN") {
        throw new AppError(status.CONFLICT, "Ticket is already open.", {
            code: "TICKET_NOT_REOPENABLE",
        });
    }

    const now = new Date();
    const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "OPEN", resolvedAt: null, updatedAt: now },
        select: { id: true, priority: true },
    });

    if (body?.reason) {
        await prisma.ticketMessage.create({
            data: {
                ticketId: ticket.id,
                authorId: agent.id,
                body: `Reopened: ${body.reason}`,
                visibility: "INTERNAL",
            },
        });
    }

    await recordAuditEvent({
        actorId: agent.id,
        kind: "TICKET_REOPENED",
        targetRef: `supportTicket:${ticket.id}`,
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        afterJson: { reason: body?.reason ?? null },
    });

    return {
        id: updated.id,
        status: "open",
        priority: toWireTicketPriority(updated.priority),
        updatedAt: now.toISOString(),
        assignee: null,
    };
};

const patch = async (
    actorUserId: string,
    ticketId: string,
    body: PatchTicketBody,
): Promise<IPatchResult> => {
    const agent = await requireSupportAgent(actorUserId);
    const ticket = await requireTicketAccess(ticketId);

    const data: Parameters<typeof prisma.supportTicket.update>[0]["data"] = {};
    const audits: Parameters<typeof recordAuditEvent>[0][] = [];
    let newAssignee: ITicketAssignee | null = null;

    if (body.priority) {
        const priorityEnum: TicketPriorityEnum =
            body.priority === "low"
                ? "LOW"
                : body.priority === "high"
                ? "HIGH"
                : body.priority === "urgent"
                ? "URGENT"
                : "NORMAL";
        const previous = await prisma.supportTicket.findUnique({
            where: { id: ticket.id },
            select: { priority: true },
        });
        data.priority = priorityEnum;
        audits.push({
            actorId: agent.id,
            kind: "PRIORITY_CHANGED",
            targetRef: `supportTicket:${ticket.id}`,
            ticketId: ticket.id,
            organizationId: ticket.organizationId,
            beforeJson: { priority: previous?.priority ?? null },
            afterJson: { priority: priorityEnum },
        });
    }

    if (body.status) {
        const statusEnum: TicketStatusEnum =
            body.status === "pending"
                ? "PENDING_STAFF"
                : body.status === "on-hold"
                ? "PENDING_CUSTOMER"
                : body.status === "resolved"
                ? "RESOLVED"
                : body.status === "closed"
                ? "CLOSED"
                : "OPEN";
        data.status = statusEnum;
        if (statusEnum === "RESOLVED" && !data.resolvedAt) {
            data.resolvedAt = new Date();
        }
        audits.push({
            actorId: agent.id,
            kind: "STATUS_CHANGED",
            targetRef: `supportTicket:${ticket.id}`,
            ticketId: ticket.id,
            organizationId: ticket.organizationId,
            afterJson: { status: statusEnum },
        });
    }

    if (body.assigneeId !== undefined) {
        // null clears the assignment; otherwise reassign.
        if (body.assigneeId === null) {
            await prisma.supportAssignment.updateMany({
                where: { ticketId: ticket.id, isCurrent: true },
                data: { isCurrent: false },
            });
            audits.push({
                actorId: agent.id,
                kind: "TICKET_REASSIGNED",
                targetRef: `supportTicket:${ticket.id}`,
                ticketId: ticket.id,
                organizationId: ticket.organizationId,
                afterJson: { assignee: null },
            });
        } else {
            // Verify the target user is a valid agent before reassigning.
            await requireSupportAgent(body.assigneeId);
            const created = await prisma.$transaction(async (tx) => {
                await tx.supportAssignment.updateMany({
                    where: { ticketId: ticket.id, isCurrent: true },
                    data: { isCurrent: false },
                });
                return tx.supportAssignment.create({
                    data: {
                        ticketId: ticket.id,
                        agentId: body.assigneeId as string,
                        assignedById: agent.id,
                        isCurrent: true,
                        reason: body.assigneeReason ?? null,
                    },
                    include: {
                        agent: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                });
            });
            audits.push({
                actorId: agent.id,
                kind: "TICKET_ASSIGNED",
                targetRef: `supportAssignment:${created.id}`,
                ticketId: ticket.id,
                organizationId: ticket.organizationId,
                afterJson: {
                    assignee: {
                        id: created.agent.id,
                        name: created.agent.name ?? null,
                        email: created.agent.email,
                    },
                },
            });
            newAssignee = {
                id: created.agent.id,
                name: created.agent.name ?? null,
                email: created.agent.email,
                assignedAt: toIso(created.createdAt) ?? "",
                reason: body.assigneeReason ?? null,
                assignedByName: agent.name,
            };
        }
    }

    data.updatedAt = new Date();

    const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data,
        select: { id: true, status: true, priority: true, updatedAt: true },
    });

    for (const a of audits) {
        await recordAuditEvent(a);
    }

    return {
        id: updated.id,
        status: toWireTicketStatus(updated.status),
        priority: toWireTicketPriority(updated.priority),
        updatedAt: toIso(updated.updatedAt) ?? "",
        assignee: newAssignee,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Local enum literal types — narrowed subsets the service writes back to Prisma
// ─────────────────────────────────────────────────────────────────────────────

type NoteVisibilityEnum = "INTERNAL_TEAM" | "LEADERSHIP" | "PRIVATE";
type SlaSeverityEnum = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
type TicketPriorityEnum = "LOW" | "NORMAL" | "HIGH" | "URGENT";
type TicketStatusEnum =
    | "OPEN"
    | "PENDING_CUSTOMER"
    | "PENDING_STAFF"
    | "RESOLVED"
    | "CLOSED";
type ResolutionCodeEnum =
    | "FIXED"
    | "WORKAROUND"
    | "DUPLICATE"
    | "WONT_FIX"
    | "CUSTOMER_RESPONDED"
    | "ESCALATED_TO_ENGINEERING"
    | "BILLING_ADJUSTMENT"
    | "OTHER";

export const ticketDetailService = {
    getDetail,
    postMessage,
    postNote,
    applyMacro,
    escalate,
    resolve,
    reopen,
    patch,
};