import { describe, expect, it } from "vitest"; import { auditLogOperations } from "./audit-log.route";
describe("A20 audit log", () => { it("is read-only except asynchronous export", () => expect(auditLogOperations).toEqual([["get", "/audit-log"], ["post", "/audit-log/export"]])); });
