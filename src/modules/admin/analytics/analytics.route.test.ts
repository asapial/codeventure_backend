import { describe, expect, it } from "vitest"; import { analyticsOperations } from "./analytics.route";
describe("A14 analytics", () => { it("exports asynchronously", () => expect(analyticsOperations[1]?.job).toBe("analytics.export")); });
