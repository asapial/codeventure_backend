import { describe, expect, it } from "vitest"; import { customerOperations } from "./customers.route";
describe("A6 customers", () => { it("exposes directory actions", () => expect(customerOperations.map(x => `${x.method} ${x.path}`)).toEqual(["get /", "post /", "post /:id/invitations"])); });
