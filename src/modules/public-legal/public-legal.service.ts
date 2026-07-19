// Public legal document service (P21).
//
// Exposes a single read-only query: `getLegalDocumentBySlug(slug)`. The endpoint
// is intentionally unauthenticated and only returns documents that have been
// promoted to PUBLISHED status — drafts and archived docs are not served.

import status from "http-status";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../errorHelpers/AppError.js";
import type { IPublicLegalDocument } from "./public-legal.type.js";

/**
 * Fetches a published legal document by its URL slug.
 *
 * @throws AppError(NOT_FOUND) if no document exists with that slug, or if the
 *         document exists but has not been published yet.
 */
const getLegalDocumentBySlug = async (slug: string): Promise<IPublicLegalDocument> => {
    const document = await prisma.legalDocument.findUnique({
        where: { slug },
        include: {
            currentVersion: true,
        },
    });

    if (!document || !document.currentVersion) {
        throw new AppError(
            status.NOT_FOUND,
            "We couldn't find that legal document.",
            { code: "LEGAL_DOCUMENT_NOT_FOUND" },
        );
    }

    if (document.status !== "PUBLISHED") {
        throw new AppError(
            status.NOT_FOUND,
            "We couldn't find that legal document.",
            { code: "LEGAL_DOCUMENT_NOT_FOUND" },
        );
    }

    return {
        slug: document.slug,
        type: document.type,
        title: document.title,
        status: document.status,
        publishedAt: document.publishedAt?.toISOString() ?? null,
        version: document.currentVersion.version,
        effectiveAt: document.currentVersion.effectiveAt.toISOString(),
        requiresReconsent: document.currentVersion.requiresReconsent,
        body: document.currentVersion.body,
    };
};

export const publicLegalService = {
    getLegalDocumentBySlug,
};
