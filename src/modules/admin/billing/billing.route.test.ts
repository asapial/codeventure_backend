import { describe, expect, it } from "vitest"; import { billingOperations } from "./billing.route";
describe("A11 billing", () => { it("step-up guards money movement", () => expect(billingOperations.filter(x => "stepUp" in x && x.stepUp).map(x => x.path)).toEqual(["/payments/offline", "/payments/:id/refund"])); });
