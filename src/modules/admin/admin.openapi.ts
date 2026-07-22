import { ADMIN_API_OPERATIONS } from "./admin.contract";

const parameterPattern = /:([A-Za-z0-9_]+)/g;

export function createAdminOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [method, route] of ADMIN_API_OPERATIONS) {
    const parameters = [...route.matchAll(parameterPattern)].map(([, name]) => ({ name, in: "path", required: true, schema: { type: "string", format: name === "id" ? "uuid" : undefined } }));
    const path = `/api/v1${route.replace(parameterPattern, "{$1}")}`;
    paths[path] ??= {};
    paths[path][method.toLowerCase()] = {
      operationId: `${method.toLowerCase()}${route.split("/").filter(Boolean).map(part => part.startsWith(":") ? `By${part.slice(1)}` : part.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()).replace(/^./, value => value.toUpperCase())).join("")}`,
      tags: ["Admin"],
      parameters,
      responses: {
        "200": { description: "Normalized admin response" },
        "400": { $ref: "#/components/responses/AdminError" },
        "401": { $ref: "#/components/responses/AdminError" },
        "403": { $ref: "#/components/responses/AdminError" },
        "404": { $ref: "#/components/responses/AdminError" },
        "409": { $ref: "#/components/responses/AdminError" },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "CodeVenture Admin API", version: "2026-07-22" },
    paths,
    components: { responses: { AdminError: { description: "Normalized error envelope", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } } }, schemas: { ErrorEnvelope: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message", "requestId"], properties: { code: { type: "string" }, message: { type: "string" }, fieldErrors: { type: "object", additionalProperties: true }, requestId: { type: "string" } } } } } } },
  } as const;
}
