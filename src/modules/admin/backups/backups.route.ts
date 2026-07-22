import { createAdminFeatureRouter, type AdminOperation } from "../admin.feature-router";
export const backupOperations = [
  { method: "get", path: "/backups", kind: "list", permission: "backups.read" },
  { method: "post", path: "/backups", kind: "create", recordType: "backup", permission: "backups.write", providerEnv: "BACKUP_PROVIDER" },
  { method: "post", path: "/backups/:id/verify", kind: "update", action: "verify", job: "backup.verify", permission: "backups.write", providerEnv: "BACKUP_PROVIDER" },
  { method: "post", path: "/backups/:id/restore-drill", kind: "update", action: "restore-drill", job: "backup.restore-drill", permission: "backups.write", providerEnv: "BACKUP_PROVIDER", stepUp: true },
] as const satisfies readonly AdminOperation[];
export const backupsRouter = createAdminFeatureRouter("backups", backupOperations);
