import { z } from "zod";

export const projectStatusSchema = z.enum([
    "draft",
    "planning",
    "in-progress",
    "review",
    "launched",
    "paused",
    "archived",
]);

/**
 * Frontend sends `?q=` (not `?search=`) from `lib/api/projects.ts`.
 * We accept both keys for forward-compatibility.
 */
const querySchema = z
    .object({
        status: z.enum(["all", ...projectStatusSchema.options]).optional(),
        q: z.string().trim().min(1).max(120).optional(),
        search: z.string().trim().min(1).max(120).optional(),
        page: z.coerce.number().int().min(1).max(500).optional().default(1),
        perPage: z.coerce.number().int().min(1).max(50).optional().default(12),
    })
    .transform((raw) => ({
        status: raw.status,
        search: raw.q ?? raw.search,
        page: raw.page,
        perPage: raw.perPage,
    }));

export const projectListQuerySchema = z.object({ query: querySchema });

export const projectSlugParamSchema = z.object({
    params: z.object({
        slug: z
            .string()
            .trim()
            .min(2)
            .max(120)
            .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u, "Slug must be kebab-case."),
    }),
});

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>["query"];
