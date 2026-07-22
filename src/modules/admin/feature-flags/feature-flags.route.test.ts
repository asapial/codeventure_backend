import { describe, expect, it } from "vitest"; import { featureFlagOperations } from "./feature-flags.route";
describe("A18 feature flags", () => { it("supports creation and versioned rollout", () => expect(featureFlagOperations.map(x => x.method)).toEqual(["get", "post", "put"])); });
