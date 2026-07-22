import { describe, expect, it } from "vitest"; import { quoteOperations } from "./quotes.route";
describe("A4 quotes", () => { it("exposes list and create", () => expect(quoteOperations.map(x => `${x.method} ${x.path}`)).toEqual(["get /", "post /"])); });
