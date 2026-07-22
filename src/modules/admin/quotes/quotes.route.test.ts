import { describe, expect, it } from "vitest"; import { quoteOperations } from "./quotes.route";
const routes = quoteOperations.map(x => `${x.method} ${x.path}`);
describe("A4-A5 quotes", () => {
  it("keeps directory methods", () => expect(routes.slice(0, 2)).toEqual(["get /", "post /"]));
  it("supports version, send and conversion workflows", () => { expect(routes).toContain("post /:id/revisions"); expect(routes).toContain("post /:id/send"); expect(routes).toContain("post /:id/convert"); });
});
