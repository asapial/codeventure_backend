/** Authoritative route manifest used by OpenAPI generation and drift tests. */
export const ADMIN_API_OPERATIONS = [
  ["GET", "/admin/dashboard"],
  ["GET", "/admin/leads"], ["POST", "/admin/leads"], ["GET", "/admin/leads/:id"], ["PATCH", "/admin/leads/:id"], ["PATCH", "/admin/leads/:id/assign"], ["PATCH", "/admin/leads/bulk"], ["POST", "/admin/leads/:id/activities"], ["POST", "/admin/leads/:id/convert"], ["POST", "/admin/leads/:id/create-quote"],
  ["GET", "/admin/quotes"], ["POST", "/admin/quotes"], ["GET", "/admin/quotes/:id"], ["PUT", "/admin/quotes/:id"], ["POST", "/admin/quotes/:id/revisions"], ["POST", "/admin/quotes/:id/send"], ["POST", "/admin/quotes/:id/convert"],
  ["GET", "/admin/customers"], ["POST", "/admin/customers"], ["GET", "/admin/customers/:id"], ["PATCH", "/admin/customers/:id/status"], ["POST", "/admin/customers/:id/invitations"], ["POST", "/admin/customers/:id/impersonation"],
  ["GET", "/admin/projects"], ["POST", "/admin/projects"], ["PATCH", "/admin/projects/bulk"], ["GET", "/admin/projects/:id"], ["PUT", "/admin/projects/:id"], ["PATCH", "/admin/projects/:id/status"], ["POST", "/admin/projects/:id/milestones"], ["POST", "/admin/projects/:id/tasks"], ["POST", "/admin/projects/:id/approvals"], ["POST", "/admin/projects/:id/change-orders"],
  ["GET", "/admin/catalog"], ["POST", "/admin/services"], ["PUT", "/admin/services/:id"], ["POST", "/admin/packages"], ["PUT", "/admin/maintenance-plans/:id"],
  ["GET", "/admin/billing"], ["POST", "/admin/invoices"], ["POST", "/admin/invoices/:id/send"], ["POST", "/admin/payments/offline"], ["POST", "/admin/payments/:id/refund"], ["POST", "/admin/billing/reconcile"],
  ["GET", "/admin/team"], ["GET", "/admin/permissions"], ["POST", "/admin/team/invitations"], ["PATCH", "/admin/team/:id"], ["PUT", "/admin/roles/:id"],
  ["GET", "/admin/content"], ["POST", "/admin/content/:type"], ["PUT", "/admin/content/:type/:id"], ["POST", "/admin/content/:type/:id/submit-review"], ["POST", "/admin/content/:type/:id/publish"], ["GET", "/admin/content/:type/:id/revisions"],
  ["GET", "/admin/analytics"], ["POST", "/admin/analytics/export"],
  ["GET", "/admin/settings"], ["PUT", "/admin/settings"],
  ["GET", "/admin/integrations"], ["PUT", "/admin/integrations/:key"], ["POST", "/admin/integrations/:key/test"], ["POST", "/admin/webhooks/:id/replay"],
  ["GET", "/admin/notifications"], ["GET", "/admin/notifications/deliveries"], ["PUT", "/admin/notifications/templates/:id"], ["POST", "/admin/notifications/templates/:id/test"],
  ["GET", "/admin/feature-flags"], ["POST", "/admin/feature-flags"], ["PUT", "/admin/feature-flags/:id"],
  ["GET", "/admin/security"], ["GET", "/admin/security/alerts"], ["PATCH", "/admin/security/alerts/:id"], ["GET", "/admin/security/sessions"], ["POST", "/admin/security/revoke-sessions"], ["GET", "/admin/security/api-keys"], ["POST", "/admin/security/api-keys"], ["DELETE", "/admin/security/api-keys/:id"], ["PUT", "/admin/security/rate-limits"],
  ["GET", "/admin/audit-log"], ["POST", "/admin/audit-log/export"],
  ["GET", "/admin/backups"], ["POST", "/admin/backups"], ["POST", "/admin/backups/:id/verify"], ["POST", "/admin/backups/:id/restore-drill"],
  ["GET", "/admin/system/health"], ["GET", "/admin/system/jobs"], ["POST", "/admin/system/jobs/:id/retry"], ["POST", "/admin/system/queues/:name/pause"],
] as const;

export type AdminApiOperation = (typeof ADMIN_API_OPERATIONS)[number];
