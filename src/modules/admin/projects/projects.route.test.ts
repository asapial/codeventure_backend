import { describe, expect, it } from "vitest"; import { projectOperations } from "./projects.route";
describe("A8 projects", () => { it("exposes directory and bulk operations", () => expect(projectOperations.map(x => `${x.method} ${x.path}`)).toEqual(["get /", "post /", "patch /bulk"])); });
