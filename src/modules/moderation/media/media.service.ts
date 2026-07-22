/**
 * M6 — Media library review service.
 *
 * Lists `MalwareScan` rows joined to `FileAsset` metadata + the
 * `FileUsage` join so a moderator can see which surfaces touch a file.
 *
 * `quarantineMedia` (action) and `clearMedia` (action) audit-only
 * side-effects: they stamp the `MalwareScan` row + append `AuditLog`
 * entries, but the `visibility` downgrade is also propagated to every
 * matching `FileUsage` row via a single `updateMany` so the surfaces
 * honour the moderator's new policy.
 */

import status from "http-status";

import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    MediaScanStatus,
    ContentType,
} from "../../../../prisma/generated/prisma/enums";
import { Prisma } from "../../../../prisma/generated/prisma/client";
import {
    requireModeratorOrAdmin,
    recordModerationAuditEvent,
    toIso,
    toWireContentType,
    toWireMediaScanStatus,
    toWireMediaVisibility,
} from "../moderation.policy";
import { parsePagination } from "../moderation.utils";
import type {
    IMediaAssetDetailResponse,
    IMediaAssetListResponse,
    IMediaAssetRow,
    IMediaClearResponse,
    IMediaQuarantineResponse,
    IMediaSurfaceUsage,
    IMediaActionRequest,
} from "./media.type";
import type { IListMediaQuery } from "./media.validation";

const mapRow = (
    r: {
        id: string;
        fileAssetId: string;
        status: string;
        vendor: string | null;
        vendorRef: string | null;
        startedAt: Date;
        completedAt: Date | null;
        fileAsset: {
            fileName: string;
            mimeType: string;
            sizeBytes: number;
            secureUrl: string | null;
        } | null;
    },
    primaryUsage: {
        surface: string;
        visibility: string;
    } | null,
    surfaceCount: number,
): IMediaAssetRow => {
    return {
        id: r.id,
        fileAssetId: r.fileAssetId,
        fileName: r.fileAsset?.fileName ?? "(unknown)",
        mimeType: r.fileAsset?.mimeType ?? "application/octet-stream",
        bytes: r.fileAsset?.sizeBytes ?? 0,
        secureUrl: r.fileAsset?.secureUrl ?? "",
        scanStatus: toWireMediaScanStatus(r.status),
        vendor: r.vendor,
        vendorRef: r.vendorRef,
        surfaceCount,
        primarySurface: primaryUsage
            ? toWireContentType(primaryUsage.surface)
            : null,
        primaryVisibility: primaryUsage
            ? toWireMediaVisibility(primaryUsage.visibility)
            : "private",
        startedAt: toIso(r.startedAt) ?? "",
        completedAt: toIso(r.completedAt),
    };
};

const listMedia = async (input: {
    actorUserId: string;
    query: IListMediaQuery;
}): Promise<IMediaAssetListResponse> => {
    await requireModeratorOrAdmin(input.actorUserId);
    const q = input.query;
    const { page, pageSize, skip, take } = parsePagination(q);

    const where: Record<string, unknown> = {};
    if (q.scanStatus) {
        where.status = q.scanStatus.toUpperCase().replace(/-/g, "_");
    } else {
        // Default: show only scans that need a moderator's eye.
        where.status = {
            in: [
                MediaScanStatus.PENDING,
                MediaScanStatus.INFECTED,
                MediaScanStatus.PROHIBITED_CONTENT,
                MediaScanStatus.SCAN_FAILED,
            ] as unknown as string[],
        };
    }

    if (q.search) {
        where.fileAsset = {
            fileName: { contains: q.search, mode: "insensitive" },
        };
    }

    const orderBy = (() => {
        const dir = q.order === "asc" ? "asc" : "desc";
        switch (q.sort) {
            case "completedAt":
                return { completedAt: dir } as const;
            case "fileName":
                return { fileAsset: { fileName: dir } } as const;
            case "sizeBytes":
                return { fileAsset: { sizeBytes: dir } } as const;
            case "startedAt":
            default:
                return { startedAt: dir } as const;
        }
    })();

    const [rows, total] = await Promise.all([
        prisma.malwareScan.findMany({
            where,
            orderBy: orderBy as
                | Prisma.MalwareScanOrderByWithRelationInput
                | Prisma.MalwareScanOrderByWithRelationInput[],
            skip,
            take,
            select: {
                id: true,
                fileAssetId: true,
                status: true,
                vendor: true,
                vendorRef: true,
                startedAt: true,
                completedAt: true,
                fileAsset: {
                    select: {
                        fileName: true,
                        mimeType: true,
                        sizeBytes: true,
                        secureUrl: true,
                    },
                },
            },
        }),
        prisma.malwareScan.count({ where }),
    ]);

    // Usage aggregations live on `FileAsset → usages` (not MalwareScan),
    // so fetch per-asset counts + most-recent usage in one round-trip each.
    const fileAssetIds = Array.from(new Set(rows.map((r) => r.fileAssetId)));
    const [counts, primaryUsages] = await Promise.all([
        fileAssetIds.length
            ? prisma.fileUsage.groupBy({
                  by: ["fileAssetId"],
                  where: { fileAssetId: { in: fileAssetIds } },
                  _count: { _all: true },
              })
            : Promise.resolve([] as Array<{ fileAssetId: string; _count: { _all: number } }>),
        fileAssetIds.length
            ? prisma.fileUsage.findMany({
                  where: { fileAssetId: { in: fileAssetIds } },
                  orderBy: { createdAt: "desc" },
                  distinct: ["fileAssetId"],
                  select: {
                      fileAssetId: true,
                      surface: true,
                      visibility: true,
                  },
              })
            : Promise.resolve(
                  [] as Array<{
                      fileAssetId: string;
                      surface: string;
                      visibility: string;
                  }>,
              ),
    ]);

    const countMap = new Map<string, number>(
        counts.map((c) => [c.fileAssetId, c._count._all]),
    );
    const primaryUsageMap = new Map<
        string,
        { surface: string; visibility: string }
    >(primaryUsages.map((u) => [u.fileAssetId, u]));

    const items: IMediaAssetRow[] = rows.map((r) =>
        mapRow(r, primaryUsageMap.get(r.fileAssetId) ?? null, countMap.get(r.fileAssetId) ?? 0),
    );
    return { items, page, pageSize, total };
};

const getMediaAsset = async (input: {
    actorUserId: string;
    scanId: string;
}): Promise<IMediaAssetDetailResponse> => {
    await requireModeratorOrAdmin(input.actorUserId);

    const row = await prisma.malwareScan.findUnique({
        where: { id: input.scanId },
        select: {
            id: true,
            fileAssetId: true,
            status: true,
            vendor: true,
            vendorRef: true,
            resultJson: true,
            startedAt: true,
            completedAt: true,
            fileAsset: {
                select: {
                    fileName: true,
                    mimeType: true,
                    sizeBytes: true,
                    secureUrl: true,
                },
            },
        },
    });
    if (!row) {
        throw new AppError(status.NOT_FOUND, "Media scan not found.");
    }

    const usages = await prisma.fileUsage.findMany({
        where: { fileAssetId: row.fileAssetId },
        orderBy: { createdAt: "desc" },
        select: {
            surface: true,
            surfaceRef: true,
            visibility: true,
            createdAt: true,
        },
    });

    const surfaces: IMediaSurfaceUsage[] = usages.map((u) => ({
        surface: toWireContentType(u.surface),
        surfaceRef: u.surfaceRef,
        visibility: toWireMediaVisibility(u.visibility),
        createdAt: toIso(u.createdAt) ?? "",
    }));

    return {
        id: row.id,
        fileAssetId: row.fileAssetId,
        fileName: row.fileAsset?.fileName ?? "(unknown)",
        mimeType: row.fileAsset?.mimeType ?? "application/octet-stream",
        bytes: row.fileAsset?.sizeBytes ?? 0,
        secureUrl: row.fileAsset?.secureUrl ?? "",
        scanStatus: toWireMediaScanStatus(row.status),
        vendor: row.vendor,
        vendorRef: row.vendorRef,
        resultJson: row.resultJson ?? null,
        startedAt: toIso(row.startedAt) ?? "",
        completedAt: toIso(row.completedAt),
        surfaces,
    };
};

const quarantineMedia = async (input: {
    actorUserId: string;
    scanId: string;
    body: IMediaActionRequest;
}): Promise<IMediaQuarantineResponse> => {
    const moderator = await requireModeratorOrAdmin(input.actorUserId);

    const existing = await prisma.malwareScan.findUnique({
        where: { id: input.scanId },
        select: { id: true, status: true, fileAssetId: true },
    });
    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Media scan not found.");
    }
    if (existing.status === MediaScanStatus.PENDING) {
        throw new AppError(
            status.UNPROCESSABLE_ENTITY,
            "Scan is still running; wait for it to complete before quarantining.",
        );
    }

    const newVisibility = input.body.visibility
        .toUpperCase()
        .replace(/-/g, "_");

    const updated = await prisma.$transaction(async (tx) => {
        const scan = await tx.malwareScan.update({
            where: { id: existing.id },
            data: { status: MediaScanStatus.INFECTED },
            select: { id: true, status: true },
        });
        // Propagate the visibility downgrade to every surface that uses the file.
        await tx.fileUsage.updateMany({
            where: { fileAssetId: existing.fileAssetId },
            data: { visibility: newVisibility as never },
        });
        return scan;
    });

    await recordModerationAuditEvent({
        actorId: moderator.id,
        kind: "MEDIA_QUARANTINED",
        targetRef: updated.id,
        contentType: ContentType.MEDIA_ASSET,
        metadata: {
            fileAssetId: existing.fileAssetId,
            visibility: newVisibility,
            reasonNote: input.body.reasonNote ?? null,
            idempotencyKey: input.body.idempotencyKey,
        },
    });

    return {
        scanId: updated.id,
        status: toWireMediaScanStatus(updated.status),
        visibility: toWireMediaVisibility(newVisibility),
    };
};

const clearMedia = async (input: {
    actorUserId: string;
    scanId: string;
    body: IMediaActionRequest;
}): Promise<IMediaClearResponse> => {
    const moderator = await requireModeratorOrAdmin(input.actorUserId);

    const existing = await prisma.malwareScan.findUnique({
        where: { id: input.scanId },
        select: { id: true, fileAssetId: true },
    });
    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Media scan not found.");
    }

    const newVisibility = input.body.visibility
        .toUpperCase()
        .replace(/-/g, "_");

    const updated = await prisma.$transaction(async (tx) => {
        const scan = await tx.malwareScan.update({
            where: { id: existing.id },
            data: { status: MediaScanStatus.CLEAN },
            select: { id: true, status: true },
        });
        await tx.fileUsage.updateMany({
            where: { fileAssetId: existing.fileAssetId },
            data: { visibility: newVisibility as never },
        });
        return scan;
    });

    await recordModerationAuditEvent({
        actorId: moderator.id,
        kind: "MEDIA_CLEARED",
        targetRef: updated.id,
        contentType: ContentType.MEDIA_ASSET,
        metadata: {
            fileAssetId: existing.fileAssetId,
            visibility: newVisibility,
            reasonNote: input.body.reasonNote ?? null,
            idempotencyKey: input.body.idempotencyKey,
        },
    });

    return {
        scanId: updated.id,
        status: toWireMediaScanStatus(updated.status),
        visibility: toWireMediaVisibility(newVisibility),
    };
};

export const mediaService = {
    listMedia,
    getMediaAsset,
    quarantineMedia,
    clearMedia,
};
