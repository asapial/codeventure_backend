/**
 * M6 — Media library review wire types.
 *
 * Aligned to the real Prisma `MalwareScan` + `FileAsset` + `FileUsage` models:
 *   MalwareScan.id / fileAssetId / status / vendor / vendorRef / resultJson /
 *     startedAt / completedAt
 *   FileAsset.fileName / mimeType / sizeBytes / secureUrl / status / scanResult
 *   FileUsage.surface / surfaceRef / visibility (counted via FileUsage rows)
 */

import type {
    MediaScanStatusWire,
    MediaVisibilityWire,
    IPagedResponse,
} from "../moderation.wire.types";

export interface IMediaAssetRow {
    id: string;
    fileAssetId: string;
    fileName: string;
    mimeType: string;
    bytes: number;
    secureUrl: string;
    scanStatus: MediaScanStatusWire;
    vendor: string | null;
    vendorRef: string | null;
    surfaceCount: number;
    primarySurface:
        | "blog-post"
        | "portfolio-case-study"
        | "testimonial"
        | "media-asset"
        | "client-publication"
        | null;
    primaryVisibility: MediaVisibilityWire;
    startedAt: string;
    completedAt: string | null;
}

export interface IMediaAssetListResponse
    extends IPagedResponse<IMediaAssetRow> {}

export interface IMediaSurfaceUsage {
    surface:
        | "blog-post"
        | "portfolio-case-study"
        | "testimonial"
        | "media-asset"
        | "client-publication";
    surfaceRef: string;
    visibility: MediaVisibilityWire;
    createdAt: string;
}

export interface IMediaAssetDetailResponse {
    id: string;
    fileAssetId: string;
    fileName: string;
    mimeType: string;
    bytes: number;
    secureUrl: string;
    scanStatus: MediaScanStatusWire;
    vendor: string | null;
    vendorRef: string | null;
    resultJson: unknown;
    startedAt: string;
    completedAt: string | null;
    surfaces: IMediaSurfaceUsage[];
}

export interface IMediaClearResponse {
    scanId: string;
    status: MediaScanStatusWire;
    visibility: MediaVisibilityWire;
}

export interface IMediaQuarantineResponse {
    scanId: string;
    status: MediaScanStatusWire;
    visibility: MediaVisibilityWire;
}

export interface IMediaActionRequest {
    visibility: MediaVisibilityWire;
    reasonNote: string | null;
    idempotencyKey: string;
}
