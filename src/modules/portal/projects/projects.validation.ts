import { z } from "zod";

const phaseEnum = z.enum([
    "discovery",
    "design",
    "build",
    "review",
    "launch",
    "maintenance",
]);

const healthEnum = z.enum(["on-track", "at-risk", "blocked"]);

const querySchema = z
    .object({
        q: z.string().trim().min(1).max(120).optional(),
        search: z.string().trim().min(1).max(120).optional(),
        phase: phaseEnum.optional(),
        health: healthEnum.optional(),
        page: z.coerce.number().int().min(1).max(500).optional().default(1),
        perPage: z.coerce.number().int().min(1).max(50).optional().default(12),
    })
    .transform((raw) => ({
        search: raw.q ?? raw.search,
        phase: raw.phase,
        health: raw.health,
        page: raw.page,
        perPage: raw.perPage,
    }));

export const projectListQuerySchema = z.object({ query: querySchema });
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>["query"];