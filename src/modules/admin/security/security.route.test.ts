import { describe, expect, it } from "vitest"; import { securityOperations } from "./security.route";
describe("A19 security", () => { it("step-up guards destructive actions", () => expect(securityOperations.filter(x => "stepUp" in x && x.stepUp).length).toBeGreaterThanOrEqual(4)); });
