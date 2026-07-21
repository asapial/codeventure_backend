/**
 * S2 — Support Ticket Inbox service.
 *
 * Paged list of tickets with computed SLA clocks + assignee state,
 * plus a `claim` mutation that reassigns a ticket to the caller.
 *
 * The `where` clause is built by `buildInboxWhere`. SLA-breach filtering
 * cannot be expressed in pure Prisma (it depends on the org's SlaPolicy),
 * so the service performs a post-fetch pass against `computeSlaClock`
 * when the caller asked for `slaBreached`.
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
    toWireSentiment,
    toWireTicketPriority,
    toWireTicketStatus,
} from "../support.policy";
import {
    asBool,
    buildInboxWhere,
    parsePagination,
    parseSort,
    truncate,
} from "../support.utils";
import type { InboxListQuery } from "./inbox.validation";
import type {
    IClaimResult,
    IInboxListResponse,
    IInboxTicketRow,
} from "./inbox.type";

/** Sensible fallback when the org hasn't configured an SLA policy. */
const DEFAULT_POLICY: SlaPolicyShape = {
    firstResponseMinutes: 240,
    resolutionMinutes: 1440,
};

/**
 * Sort allow-list — maps the public `sort` query to a Prisma orderBy.
 * `slaDueAt` isn't a real column; we fall back to `updatedAt` asc so the
 * inbox's "most urgent first" still surfaces freshly-updated rows.
 */
const INBOX_SORT: Record<string, Parameters<typeof parseSort>[0]["allowed"][string]> = {
    updatedAt: { updatedAt: "desc" },
    createdAt: { createdAt: "desc" },
    priority: { priority: "desc" },
    ticketNumber: { ticketNumber: "asc" },
    slaDueAt: { updatedAt: "asc" },
};

const list = async (
    query: InboxListQuery,
    actorUserId: string,
): Promise<IInboxListResponse> => {
    await requireSupportAgent(actorUserId);

    const where = buildInboxWhere({
        q: query.q,
        status: query.status,
        priority: query.priority,
        assigneeId: query.assigneeId,
        unassigned: asBool(query.unassigned) || query.unassigned === true,
        slaBreached: asBool(query.slaBreached),
        organizationId: query.organizationId,
    });

    const { page, pageSize, skip, take } = parsePagination({
        page: query.page,
        pageSize: query.pageSize,
    });

    const orderBy = parseSort({
        sort: query.sort,
        order: query.order,
        allowed: INBOX_SORT,
        defaultSort: "updatedAt",
    });

    // Run list + count + SLA policy map + assignee facet in parallel.
    const [rows, total, slaPoliciesByOrg, assignees] = await Promise.all([
        prisma.supportTicket.findMany({
            where,
            orderBy,
            skip,
            take,
            select: inboxRowSelect,
        }),
        prisma.supportTicket.count({ where }),
        loadSlaPoliciesByOrg(),
        prisma.user.findMany({
            where: {
                role: { in: ["ADMIN", "TEACHER"] as never },
                supportAssignments: { some: { isCurrent: true } },
                isDeleted: false,
                isActive: true,
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
            take: 50,
        }),
    ]);

    // Last customer-visible message per ticket — single grouped query,
    // then map by id.
    const lastMessageByTicket = await loadLastMessagesByTicket(
        rows.map((r) => r.id),
    );

    // ── Compute SLA clocks + map to wire rows ────────────────────────────
    const items: IInboxTicketRow[] = [];
    const slaCounts = { breached: 0, warning: 0, onTrack: 0 };
    const now = new Date();
    const requireBreached =
        (where as { __slaBreached?: boolean }).__slaBreached === true;

    for (const t of rows) {
        const policy = slaPoliciesByOrg.get(t.organizationId) ?? DEFAULT_POLICY;
        // SupportTicket has no `firstRespondedAt` column; treat as null
        // (the clock renderer will show "not yet responded").
        const clock = computeSlaClock(t.createdAt, null, policy, now);

        const isBreached =
            clock.firstResponseState === "breached" ||
            clock.resolutionState === "breached";
        const isWarning =
            clock.firstResponseState === "warning" ||
            clock.resolutionState === "warning";

        if (isBreached) slaCounts.breached += 1;
        else if (isWarning) slaCounts.warning += 1;
        else slaCounts.onTrack += 1;

        if (requireBreached && !isBreached) continue;

        const currentAssignment = t.supportAssignments[0] ?? null;
        const last = lastMessageByTicket.get(t.id);

        items.push({
            ticketId: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            organizationName: t.organization.name,
            organizationId: t.organizationId,
            status: toWireTicketStatus(t.status),
            priority: toWireTicketPriority(t.priority),
            sentiment: toWireSentiment(t.sentiment) ?? "neutral",
            requesterName: t.requester?.name ?? null,
            requesterEmail: t.requester?.email ?? null,
            assignee: currentAssignment?.agent
                ? {
                    id: currentAssignment.agent.id,
                    name: currentAssignment.agent.name ?? null,
                    email: currentAssignment.agent.email,
                }
                : null,
            messageCount: t._count.messages,
            internalNoteCount: t._count.internalNotes,
            firstResponseState: clock.firstResponseState,
            resolutionState: clock.resolutionState,
            minutesSinceOpen: clock.minutesSinceOpen ?? 0,
            minutesToResolutionDue: clock.minutesToResolutionDue,
            lastUpdatedAt: toIso(t.updatedAt) ?? "",
            lastMessagePreview: last ? truncate(last.preview, 160) : null,
            lastMessageAt: toIso(last?.sentAt ?? null),
        });
    }

    return {
        items,
        page,
        pageSize,
        total,
        filters: {
            statuses: ["open", "pending", "on-hold", "resolved", "closed"],
            priorities: ["low", "normal", "high", "urgent"],
            assignees: assignees.map((a) => ({
                id: a.id,
                name: a.name ?? null,
                email: a.email,
            })),
        },
        slaCounts,
    };
};

/**
 * Claim a ticket for the caller. Replaces any current assignment and
 * writes a `TICKET_ASSIGNED` audit event.
 */
const claim = async (
    ticketId: string,
    actorUserId: string,
    reason: string | undefined,
): Promise<IClaimResult> => {
    const agent = await requireSupportAgent(actorUserId);
    const ticket = await requireTicketAccess(ticketId);

    if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
        throw new AppError(
            status.CONFLICT,
            "Ticket is already resolved or closed — cannot claim.",
            { code: "TICKET_NOT_CLAIMABLE" },
        );
    }

    // Flip any existing current assignment for the same ticket, then insert
    // the new one.
    const result = await prisma.$transaction(async (tx) => {
        await tx.supportAssignment.updateMany({
            where: { ticketId, isCurrent: true },
            data: { isCurrent: false },
        });
        const created = await tx.supportAssignment.create({
            data: {
                ticketId,
                agentId: agent.id,
                assignedById: agent.id,
                isCurrent: true,
                reason: reason ?? null,
            },
        });
        return created;
    });

    await recordAuditEvent({
        actorId: agent.id,
        kind: "TICKET_ASSIGNED",
        targetRef: `supportAssignment:${result.id}`,
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        afterJson: {
            ticketId: ticket.id,
            agentId: agent.id,
            reason: reason ?? null,
            assignedAt: result.createdAt,
        },
    });

    return {
        ticketId: ticket.id,
        assignedTo: {
            id: agent.id,
            name: agent.name,
            email: agent.email,
        },
        assignedAt: toIso(result.createdAt) ?? new Date().toISOString(),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared Prisma `select` for an inbox row. Keeps the row shape stable so
 * the wire mapping can stay one type-narrow path.
 */
const inboxRowSelect = {
    id: true,
    ticketNumber: true,
    subject: true,
    status: true,
    priority: true,
    sentiment: true,
    createdAt: true,
    updatedAt: true,
    organizationId: true,
    organization: { select: { name: true } },
    requester: { select: { name: true, email: true } },
    supportAssignments: {
        where: { isCurrent: true },
        take: 1,
        select: {
            agent: { select: { id: true, name: true, email: true } },
        },
    },
    _count: {
        select: { messages: true, internalNotes: true },
    },
} as const;

/**
 * Load every org's "in effect" SLA policy into a Map keyed by orgId.
 * Mirrors the dashboard loader — kept duplicated because the two
 * surfaces have different cache-life expectations.
 */
const loadSlaPoliciesByOrg = async (): Promise<Map<string, SlaPolicyShape>> => {
    const policies = await prisma.slaPolicy.findMany({
        where: { organizationId: { not: null } },
        select: {
            organizationId: true,
            firstResponseMinutes: true,
            resolutionMinutes: true,
        },
    });
    const map = new Map<string, SlaPolicyShape>();
    for (const p of policies) {
        if (!p.organizationId) continue;
        map.set(p.organizationId, {
            firstResponseMinutes: p.firstResponseMinutes,
            resolutionMinutes: p.resolutionMinutes,
        });
    }
    return map;
};

/**
 * Load the most recent message per ticket in a single grouped query,
 * then map by ticket id for O(1) lookup in the row loop.
 */
const loadLastMessagesByTicket = async (
    ticketIds: string[],
): Promise<Map<string, { preview: string; sentAt: Date }>> => {
    const map = new Map<string, { preview: string; sentAt: Date }>();
    if (ticketIds.length === 0) return map;
    const messages = await prisma.ticketMessage.findMany({
        where: { ticketId: { in: ticketIds } },
        orderBy: { createdAt: "desc" },
        select: { ticketId: true, body: true, createdAt: true },
    });
    for (const m of messages) {
        if (!map.has(m.ticketId)) {
            map.set(m.ticketId, { preview: m.body, sentAt: m.createdAt });
        }
    }
    return map;
};

export const inboxService = { list, claim };