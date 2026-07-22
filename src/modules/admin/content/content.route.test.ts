import { describe, expect, it } from "vitest"; import { contentOperations } from "./content.route";
describe("A13 content", () => { it("covers review, publish and revisions", () => expect(contentOperations.map(x => x.path)).toEqual(expect.arrayContaining(["/content/:type/:id/submit-review", "/content/:type/:id/publish", "/content/:type/:id/revisions"]))); });
