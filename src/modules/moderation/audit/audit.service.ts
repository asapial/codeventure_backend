/**
 * M7 — Moderation audit timeline service.
 *
 * Read-only aggregation over `AuditLog`. Filters rows whose `kind` is one
 * of the 9 moderation kinds (enforced by the schema enum — no runtime cast
 * needed). Joins `actor` so the timeline can show "who decided what".
 *
 * `summary` is a short, human-readable projection of the event's
 * `targetRef` + `kind`. The full forensic JSON lives in `metadata` so a
 * moderator can drill in.
 */

import { prisma } from "../../../lib/prisma";
import { Prisma } from "../../../../prisma/generated/prisma/client";
import { AuditEventType } from "../../../../prisma/generated/prisma/enums";
import {
    requireModeratorOrAdmin,
    toWireContentType,
} from "../moderation.policy";
import { parsePagination } from "../moderation.utils";
import type {
    IAuditTimelineKinds,
    IAuditTimelineListResponse,
    IAuditTimelineRow,
    ModerationAuditKind,
} from "./audit.type";
import type { IListAuditQuery } from "./audit.validation";

const MODERATION_KINDS: AuditEventType[] = [
    "CONTENT_APPROVED",
    "CONTENT_BLOCKED",
    "CONTENT_CHANGES_REQUESTED",
    "CONTENT_ESCALATED",
    "MEDIA_QUARANTINED",
    "MEDIA_CLEARED",
    "TESTIMONIAL_CONSENT_VERIFIED",
    "CLIENT_PUBLICATION_APPROVED",
    "CLIENT_PUBLICATION_REVOKED",
];

const buildSummary = (kind: string, targetRef: string): string => {
    switch (kind) {
        case "CONTENT_APPROVED":
            return `Approved: ${targetRef}`;
        case "CONTENT_BLOCKED":
            return `Blocked: ${targetRef}`;
        case "CONTENT_CHANGES_REQUESTED":
            return `Changes requested: ${targetRef}`;
        case "CONTENT_ESCALATED":
            return `Escalated: ${targetRef}`;
        case "MEDIA_QUARANTINED":
            return `Media quarantined: ${targetRef}`;
        case "MEDIA_CLEARED":
            return `Media cleared: ${targetRef}`;
        case "TESTIMONIAL_CONSENT_VERIFIED":
            return `Testimonial consent verified: ${targetRef}`;
        case "CLIENT_PUBLICATION_APPROVED":
            return `Client publication approved: ${targetRef}`;
        case "CLIENT_PUBLICATION_REVOKED":
            return `Client publication revoked: ${targetRef}`;
        default:
            return `${kind}: ${targetRef}`;
    }
};

const mapRow = (r: {
    id: string;
    kind: string;
    targetRef: string;
    metadata: unknown;
    customerVisible: boolean;
    createdAt: Date;
    actor: { name: string | null; email: string } | null;
}): IAuditTimelineRow => {
    const meta = (r.metadata ?? {}) as { contentType?: string | null };
    return {
        id: r.id,
        kind: r.kind as ModerationAuditKind,
        targetRef: r.targetRef,
        contentType: meta.contentType
            ? toWireContentType(meta.contentType)
            : null,
        actorName: r.actor?.name ?? null,
        actorEmail: r.actor?.email ?? null,
        summary: buildSummary(r.kind, r.targetRef),
        metadata: r.metadata ?? null,
        customerVisible: r.customerVisible,
        createdAt: r.createdAt.toISOString(),
    };
};

const listAudit = async (input: {
    actorUserId: string;
    query: IListAuditQuery;
}): Promise<IAuditTimelineListResponse> => {
    await requireModeratorOrAdmin(input.actorUserId);
    const q = input.query;
    const { page, pageSize, skip, take } = parsePagination(q);

    const where: Record<string, unknown> = {
        kind: { in: MODERATION_KINDS },
    };
    if (q.kind) where.kind = q.kind;
    if (q.actorId) where.actorId = q.actorId;
    if (q.targetRef) where.targetRef = q.targetRef;
    if (q.customerVisible !== undefined) {
        where.customerVisible = q.customerVisible;
    }
    if (q.from || q.to) {
        where.createdAt = {
            ...(q.from ? { gte: q.from } : {}),
            ...(q.to ? { lte: q.to } : {}),
        };
    }

    const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: q.order },
            skip,
            take,
            select: {
                id: true,
                kind: true,
                targetRef: true,
                metadata: true,
                customerVisible: true,
                createdAt: true,
                actor: { select: { name: true, email: true } },
            },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        items: rows.map(mapRow),
        page,
        pageSize,
        total,
    };
};

const getAuditBreakdown = async (input: {
    actorUserId: string;
}): Promise<IAuditTimelineKinds> => {
    await requireModeratorOrAdmin(input.actorUserId);
    const rows = await prisma.auditLog.groupBy({
        by: ["kind"],
        where: { kind: { in: MODERATION_KINDS } },
        _count: { _all: true },
    });
    const total = rows.reduce(
        (sum, r) => sum + ((r as unknown as { _count: { _all: number } })._count._all),
        0,
    );
    return {
        total,
        byKind: rows
        .map((r) => {
            const narrowed = r as unknown as {
                kind: AuditEventType;
                _count: { _all: number };
            };
            return {
                kind: narrowed.kind as ModerationAuditKind,
                count: narrowed._count._all,
            };
        })
        .sort((a, b) => b.count - a.count),
    };
};

export const auditService = {
    listAudit,
    getAuditBreakdown,
};