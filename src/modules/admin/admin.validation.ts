import { z } from "zod";
export const adminListSchema = z.object({ query: z.object({ q: z.string().trim().max(160).optional(), status: z.string().trim().max(40).optional(), organizationId: z.string().uuid().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) }) });
export const adminIdSchema = z.object({ params: z.object({ id: z.string().uuid() }) });
export const adminBodySchema = z.object({ body: z.record(z.string(), z.unknown()).default({}) });
export const adminIdBodySchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.record(z.string(), z.unknown()).default({}) });
export const adminNamedBodySchema = z.object({ params: z.record(z.string(), z.string().min(1)), body: z.record(z.string(), z.unknown()).default({}) });
