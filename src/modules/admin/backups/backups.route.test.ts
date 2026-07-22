import { describe, expect, it } from "vitest"; import { backupOperations } from "./backups.route";
describe("A21 backups", () => { it("requires a provider and step-up for restore", () => { expect(backupOperations.every(x => x.method === "get" || x.providerEnv === "BACKUP_PROVIDER")).toBe(true); expect(backupOperations[3]?.stepUp).toBe(true); }); });
