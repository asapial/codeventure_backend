import { z } from "zod";

/**
 * S5 — Customer Profile validation.
 *
 * The profile endpoint exposes health + activity + the team-only "flag"
 * mutation. Mutations are gated to ADMIN/TEACHER; the route aggregator
 * already enforces that — we still validate input shape here.
 */

export const organizationIdParamSchema = z.object({
    id: z.string().uuid("Invalid organization id."),
});

export type OrganizationIdParam = z.infer<typeof organizationIdParamSchema>;

export const profileFlagBodySchema = z.object({
    /// New `AccountStatus` value. `reason` is mandatory for any non-ACTIVE flip.
    status: z.enum(["active", "at-risk", "churning", "dormant", "closed"]),
    reason: z.string().trim().min(1).max(500).optional(),
});

export type ProfileFlagBody = z.infer<typeof profileFlagBodySchema>;

export const profileNoteBodySchema = z.object({
    /// Free-form agent note surfaced in the activity timeline.
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2000).optional(),
    href: z.string().trim().max(500).optional(),
});

export type ProfileNoteBody = z.infer<typeof profileNoteBodySchema>;