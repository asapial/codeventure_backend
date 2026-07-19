// Public type declarations for the public-legal module (P21).
// No auth flows here — these responses are safe to cache and expose.

import type { LegalDocumentStatus, LegalDocumentType } from "../../../prisma/generated/prisma/enums.js";

export interface IPublicLegalDocument {
    /** The document slug used in the URL — e.g. "privacy-policy". */
    slug: string;
    /** Stable machine-readable type code, separate from the slug. */
    type: LegalDocumentType;
    /** Human-friendly title shown at the top of the rendered page. */
    title: string;
    /** Only "PUBLISHED" documents are served by the public endpoint. */
    status: LegalDocumentStatus;
    /** When the document was first published (or null while still draft). */
    publishedAt: string | null;
    /** Version number of the body being served (starts at 1, increments on republish). */
    version: number;
    /** ISO timestamp for when this version took effect. */
    effectiveAt: string;
    /** When true, users need to re-consent on their next login. */
    requiresReconsent: boolean;
    /** The full body content as markdown / rich text. */
    body: string;
}
