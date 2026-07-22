import { describe, expect, it } from "vitest"; import { notificationOperations } from "./notifications.route";
describe("A17 notifications", () => { it("separates templates and delivery logs", () => expect(notificationOperations.map(x => x.path)).toContain("/notifications/deliveries")); });
