import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const notificationOperations = [
  { method: "get", path: "/notifications", kind: "list", permission: "notifications.read" },
  { method: "get", path: "/notifications/deliveries", kind: "list", permission: "notifications.read" },
  { method: "put", path: "/notifications/templates/:id", kind: "update", action: "update-template", permission: "notifications.write" },
  { method: "post", path: "/notifications/templates/:id/test", kind: "job", job: "notification.test", permission: "notifications.write" },
] as const satisfies readonly AdminOperation[];
export const notificationsRouter = createAdminFeatureRouter("notifications", notificationOperations);
