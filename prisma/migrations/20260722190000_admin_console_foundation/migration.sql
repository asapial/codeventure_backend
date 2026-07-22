ALTER TABLE "session" ADD COLUMN "stepUpVerifiedAt" TIMESTAMP(3);

CREATE TABLE "admin_record" (
  "id" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "recordType" TEXT NOT NULL,
  "organizationId" TEXT,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_audit_log" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "organizationId" TEXT,
  "requestId" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_idempotency_key" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "response" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_idempotency_key_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_permission_grant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "grantedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_permission_grant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_outbox_job" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "queue" TEXT NOT NULL DEFAULT 'admin',
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "requestedById" TEXT,
  "idempotencyKey" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_outbox_job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_queue_control" (
  "name" TEXT NOT NULL,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_queue_control_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "admin_record_feature_recordType_status_createdAt_idx" ON "admin_record"("feature", "recordType", "status", "createdAt");
CREATE INDEX "admin_record_organizationId_feature_updatedAt_idx" ON "admin_record"("organizationId", "feature", "updatedAt");
CREATE INDEX "admin_record_title_idx" ON "admin_record"("title");
CREATE INDEX "admin_audit_log_actorId_createdAt_idx" ON "admin_audit_log"("actorId", "createdAt");
CREATE INDEX "admin_audit_log_action_targetType_createdAt_idx" ON "admin_audit_log"("action", "targetType", "createdAt");
CREATE INDEX "admin_audit_log_organizationId_createdAt_idx" ON "admin_audit_log"("organizationId", "createdAt");
CREATE INDEX "admin_audit_log_requestId_idx" ON "admin_audit_log"("requestId");
CREATE UNIQUE INDEX "admin_idempotency_key_actorId_scope_keyHash_key" ON "admin_idempotency_key"("actorId", "scope", "keyHash");
CREATE INDEX "admin_idempotency_key_expiresAt_idx" ON "admin_idempotency_key"("expiresAt");
CREATE UNIQUE INDEX "admin_permission_grant_userId_permission_key" ON "admin_permission_grant"("userId", "permission");
CREATE INDEX "admin_permission_grant_permission_idx" ON "admin_permission_grant"("permission");
CREATE UNIQUE INDEX "admin_outbox_job_kind_idempotencyKey_key" ON "admin_outbox_job"("kind", "idempotencyKey");
CREATE INDEX "admin_outbox_job_queue_status_scheduledAt_idx" ON "admin_outbox_job"("queue", "status", "scheduledAt");
