// Validation schemas for the public-legal module (P21).
// This endpoint serves published legal documents to unauthenticated visitors,
// so the only input is the slug URL parameter.

import { z } from "zod";

// Slug rules:
// - lowercase, kebab-case identifier that matches what the marketing site uses
//   (e.g. "privacy-policy", "terms-of-service").
// - 3–60 chars: short enough to fit in URLs, long enough to be descriptive.
// - Must start with a letter and contain only letters, digits, and dashes.
export const legalSlugSchema = z
    .string()
    .min(3, { message: "Slug must be at least 3 characters long." })
    .max(60, { message: "Slug must be at most 60 characters long." })
    .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, {
        message: "Slug must start with a letter, contain only lowercase letters, digits, and dashes, and not end with a dash.",
    });

export const getLegalDocumentSchema = z.object({
    // The middleware at src/middleware/validateRequest.ts always feeds
    // { body, params, query }, so we have to nest the slug under `params`.
    params: z.object({
        slug: legalSlugSchema,
    }),
    body: z.object({}).optional(),
    query: z.object({}).optional(),
});

export type GetLegalDocumentInput = z.infer<typeof getLegalDocumentSchema>;
