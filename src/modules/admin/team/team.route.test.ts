import { describe, expect, it } from "vitest"; import { teamOperations } from "./team.route";
describe("A12 team", () => { it("guards role changes with step-up", () => expect("stepUp" in teamOperations[4]! && teamOperations[4].stepUp).toBe(true)); });
