
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PLANNING', 'IN_PROGRESS', 'IN_REVIEW', 'LAUNCHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_STATUS_CHANGED', 'DELIVERABLE_CREATED', 'DELIVERABLE_UPDATED', 'DELIVERABLE_STATUS_CHANGED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'COMMENT_POSTED', 'FILE_UPLOADED', 'BILLING_EVENT', 'AUTH_LOGIN', 'AUTH_2FA_VERIFIED', 'AUTH_PASSWORD_RESET', 'AUTH_EMAIL_VERIFIED');

-- CreateEnum
CREATE TYPE "TwoFactorMethod" AS ENUM ('TOTP', 'EMAIL_OTP', 'RECOVERY_CODE');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET', 'TWO_FACTOR_EMAIL');

-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'COOKIE_POLICY', 'ACCEPTABLE_USE', 'SERVICE_POLICY');

-- CreateEnum
CREATE TYPE "LegalDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReferralSourceType" AS ENUM ('DIRECT', 'ORGANIC_SEARCH', 'PAID_AD', 'SOCIAL', 'REFERRAL', 'EMAIL_CAMPAIGN', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('ON_TRACK', 'AT_RISK', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ProjectPhase" AS ENUM ('DISCOVERY', 'DESIGN', 'BUILD', 'REVIEW', 'LAUNCH', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "MaintenanceCadence" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "MaintenanceSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MaintenanceRequestType" AS ENUM ('UPDATE', 'BUG_FIX', 'CONTENT_EDIT', 'PERFORMANCE', 'SECURITY', 'BACKUP_RESTORE', 'CONSULT');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING_CUSTOMER', 'PENDING_STAFF', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketMessageVisibility" AS ENUM ('CUSTOMER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('PROJECT', 'APPROVAL', 'INVOICE', 'MAINTENANCE', 'SUPPORT', 'SECURITY', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CommunicationPreference" AS ENUM ('EMAIL', 'PHONE', 'SLACK', 'TEAMS');

-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING', 'READY', 'SCANNING', 'INFECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResolutionCode" AS ENUM ('FIXED', 'WORKAROUND', 'DUPLICATE', 'WONT_FIX', 'CUSTOMER_RESPONDED', 'ESCALATED_TO_ENGINEERING', 'BILLING_ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'AT_RISK');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'AT_RISK', 'CHURNING', 'DORMANT', 'CLOSED');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('INTERNAL_TEAM', 'LEADERSHIP', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SlaSeverity" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('TICKET_CREATED', 'TICKET_ASSIGNED', 'TICKET_REASSIGNED', 'TICKET_ESCALATED', 'TICKET_RESOLVED', 'TICKET_CLOSED', 'TICKET_REOPENED', 'MESSAGE_POSTED', 'INTERNAL_NOTE_ADDED', 'PRIORITY_CHANGED', 'STATUS_CHANGED', 'MACRO_APPLIED', 'ARTICLE_PUBLISHED', 'ARTICLE_REVISED', 'CUSTOMER_FLAGGED');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "HelpArticleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "accountRole" "AccountRole" NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "jobTitle" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorMethod" "TwoFactorMethod",
    "twoFactorEnrolledAt" TIMESTAMP(3),
    "twoFactorSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_challenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "TwoFactorMethod" NOT NULL,
    "challengeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_code" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "recipient" TEXT,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "challengeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_code" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_code_use" (
    "id" TEXT NOT NULL,
    "recoveryCodeId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_code_use_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_run" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "signupSource" "ReferralSourceType" NOT NULL DEFAULT 'DIRECT',
    "referralCode" TEXT,
    "referralSourceId" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "privacyAcceptedAt" TIMESTAMP(3),
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_member" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'VIEWER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'VIEWER',
    "invitedById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_source" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "heroImageUrl" TEXT,
    "accentColor" TEXT,
    "startDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "budgetAmount" DECIMAL(12,2),
    "budgetCurrency" TEXT DEFAULT 'USD',
    "spentAmount" DECIMAL(12,2),
    "ownerId" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_member" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'VIEWER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverable" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DeliverableStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_event" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "actorId" TEXT,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_summary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "planName" TEXT NOT NULL DEFAULT 'Starter',
    "planAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "usedHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "includedHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "activeProjects" INTEGER NOT NULL DEFAULT 0,
    "totalProjects" INTEGER NOT NULL DEFAULT 0,
    "nextInvoiceDate" TIMESTAMP(3),
    "nextInvoiceAmount" DECIMAL(12,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'VIEWER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document" (
    "id" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "LegalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document_version" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "requiresReconsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "user_consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_assignment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedById" TEXT,
    "reason" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_note" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'INTERNAL_TEAM',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_event" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "triggeredById" TEXT NOT NULL,
    "fromPriority" "TicketPriority" NOT NULL,
    "toPriority" "TicketPriority" NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" "SlaSeverity" NOT NULL,
    "etaMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "severity" "SlaSeverity" NOT NULL,
    "firstResponseMinutes" INTEGER NOT NULL,
    "resolutionMinutes" INTEGER NOT NULL,
    "businessHoursTz" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canned_response" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canned_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_support_profile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "avgFirstResponseMin" INTEGER,
    "avgResolutionMin" INTEGER,
    "csatScore" DOUBLE PRECISION,
    "churnRisk" INTEGER NOT NULL DEFAULT 0,
    "openTicketCount" INTEGER NOT NULL DEFAULT 0,
    "awaitingCustomerCount" INTEGER NOT NULL DEFAULT 0,
    "overdueInvoiceCount" INTEGER NOT NULL DEFAULT 0,
    "lastTouchedById" TEXT,
    "lastTouchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_support_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_activity_log" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "href" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_revision" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_feedback" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT,
    "wasHelpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_attachment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_metric_daily" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "ticketsOpened" INTEGER NOT NULL DEFAULT 0,
    "ticketsResolved" INTEGER NOT NULL DEFAULT 0,
    "ticketsEscalated" INTEGER NOT NULL DEFAULT 0,
    "ticketsReopened" INTEGER NOT NULL DEFAULT 0,
    "avgFirstResponseMin" INTEGER,
    "avgResolutionMin" INTEGER,
    "backlogOpen" INTEGER NOT NULL DEFAULT 0,
    "csatResponses" INTEGER NOT NULL DEFAULT 0,
    "csatAverage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_metric_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" "AuditEventType" NOT NULL,
    "targetRef" TEXT NOT NULL,
    "ticketId" TEXT,
    "organizationId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "metadata" JSONB,
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_job_run" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedById" TEXT,
    "parameters" JSONB,
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_job_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "companyName" TEXT,
    "businessType" TEXT,
    "websiteUrl" TEXT,
    "billingAddress" JSONB,
    "primaryContact" JSONB,
    "brandAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timezone" TEXT,
    "locale" TEXT,
    "communication" "CommunicationPreference" NOT NULL DEFAULT 'EMAIL',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logoAssetId" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "fontFamily" TEXT,
    "voiceNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_asset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "secureUrl" TEXT,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING',
    "scanResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "phase" "ProjectPhase" NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "artifactRef" TEXT NOT NULL,
    "artifactVersion" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_response" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "decision" "ApprovalStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_request" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedCost" DECIMAL(12,2),
    "estimatedDays" INTEGER,
    "impact" TEXT DEFAULT 'MEDIUM',
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_file" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storageKey" TEXT NOT NULL,
    "secureUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "includedHours" DECIMAL(8,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "cadence" "MaintenanceCadence" NOT NULL,
    "status" "MaintenanceSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "includedHours" DECIMAL(8,2) NOT NULL,
    "usedHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_request" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requestType" "MaintenanceRequestType" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_report" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "workCompleted" JSONB NOT NULL,
    "backupsVerified" BOOLEAN NOT NULL DEFAULT false,
    "securityChecks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_profile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "billingEmail" TEXT,
    "paymentProvider" TEXT,
    "paymentMethodMasked" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_item" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "projectId" TEXT,
    "ticketNumber" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "slaDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_message" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "TicketMessageVisibility" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_attachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "searchTokens" TEXT NOT NULL,
    "status" "HelpArticleStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulYes" INTEGER NOT NULL DEFAULT 0,
    "helpfulNo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailProject" BOOLEAN NOT NULL DEFAULT true,
    "emailApproval" BOOLEAN NOT NULL DEFAULT true,
    "emailInvoice" BOOLEAN NOT NULL DEFAULT true,
    "emailSupport" BOOLEAN NOT NULL DEFAULT true,
    "emailMaintenance" BOOLEAN NOT NULL DEFAULT true,
    "emailSecurity" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'QUEUED',
    "storageKey" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "data_export_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_token_tokenHash_key" ON "password_reset_token"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_token_userId_idx" ON "password_reset_token"("userId");

-- CreateIndex
CREATE INDEX "password_reset_token_expiresAt_idx" ON "password_reset_token"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "auth_challenge_challengeHash_key" ON "auth_challenge"("challengeHash");

-- CreateIndex
CREATE INDEX "auth_challenge_userId_idx" ON "auth_challenge"("userId");

-- CreateIndex
CREATE INDEX "auth_challenge_expiresAt_idx" ON "auth_challenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "otp_code_challengeId_key" ON "otp_code"("challengeId");

-- CreateIndex
CREATE INDEX "otp_code_userId_idx" ON "otp_code"("userId");

-- CreateIndex
CREATE INDEX "otp_code_purpose_expiresAt_idx" ON "otp_code"("purpose", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_code_codeHash_key" ON "recovery_code"("codeHash");

-- CreateIndex
CREATE INDEX "recovery_code_userId_idx" ON "recovery_code"("userId");

-- CreateIndex
CREATE INDEX "recovery_code_use_recoveryCodeId_idx" ON "recovery_code_use"("recoveryCodeId");

-- CreateIndex
CREATE INDEX "recovery_code_use_challengeId_idx" ON "recovery_code_use"("challengeId");

-- CreateIndex
CREATE INDEX "login_device_userId_idx" ON "login_device"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "login_device_userId_fingerprint_key" ON "login_device"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "security_alert_userId_createdAt_idx" ON "security_alert"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "job_run_runAfter_idx" ON "job_run"("runAfter");

-- CreateIndex
CREATE INDEX "job_run_completedAt_idx" ON "job_run"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profile_userId_key" ON "customer_profile"("userId");

-- CreateIndex
CREATE INDEX "customer_profile_signupSource_idx" ON "customer_profile"("signupSource");

-- CreateIndex
CREATE INDEX "customer_profile_organizationId_idx" ON "customer_profile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organization_member_organizationId_idx" ON "organization_member"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_member_userId_organizationId_key" ON "organization_member"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tokenHash_key" ON "invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_source_code_key" ON "referral_source"("code");

-- CreateIndex
CREATE UNIQUE INDEX "project_slug_key" ON "project"("slug");

-- CreateIndex
CREATE INDEX "project_status_idx" ON "project"("status");

-- CreateIndex
CREATE INDEX "project_ownerId_idx" ON "project"("ownerId");

-- CreateIndex
CREATE INDEX "project_isDeleted_idx" ON "project"("isDeleted");

-- CreateIndex
CREATE INDEX "project_member_userId_idx" ON "project_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_member_projectId_userId_key" ON "project_member"("projectId", "userId");

-- CreateIndex
CREATE INDEX "deliverable_projectId_idx" ON "deliverable"("projectId");

-- CreateIndex
CREATE INDEX "deliverable_status_idx" ON "deliverable"("status");

-- CreateIndex
CREATE INDEX "activity_event_projectId_createdAt_idx" ON "activity_event"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_event_actorId_idx" ON "activity_event"("actorId");

-- CreateIndex
CREATE INDEX "billing_summary_userId_idx" ON "billing_summary"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_summary_userId_month_key" ON "billing_summary"("userId", "month");

-- CreateIndex
CREATE INDEX "account_membership_userId_idx" ON "account_membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_type_key" ON "legal_document"("type");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_slug_key" ON "legal_document"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_currentVersionId_key" ON "legal_document"("currentVersionId");

-- CreateIndex
CREATE INDEX "legal_document_version_documentId_idx" ON "legal_document_version"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_version_documentId_version_key" ON "legal_document_version"("documentId", "version");

-- CreateIndex
CREATE INDEX "user_consent_userId_idx" ON "user_consent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_consent_userId_documentVersionId_key" ON "user_consent"("userId", "documentVersionId");

-- CreateIndex
CREATE INDEX "support_assignment_ticketId_createdAt_idx" ON "support_assignment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "support_assignment_agentId_createdAt_idx" ON "support_assignment"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "internal_note_ticketId_createdAt_idx" ON "internal_note"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "escalation_event_ticketId_createdAt_idx" ON "escalation_event"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "escalation_event_severity_createdAt_idx" ON "escalation_event"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "sla_policy_organizationId_severity_idx" ON "sla_policy"("organizationId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "canned_response_shortcut_key" ON "canned_response"("shortcut");

-- CreateIndex
CREATE INDEX "canned_response_authorId_archived_idx" ON "canned_response"("authorId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "organization_support_profile_organizationId_key" ON "organization_support_profile"("organizationId");

-- CreateIndex
CREATE INDEX "customer_activity_log_organizationId_createdAt_idx" ON "customer_activity_log"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_revision_articleId_version_key" ON "content_revision"("articleId", "version");

-- CreateIndex
CREATE INDEX "knowledge_feedback_articleId_createdAt_idx" ON "knowledge_feedback"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "article_attachment_articleId_idx" ON "article_attachment"("articleId");

-- CreateIndex
CREATE INDEX "support_metric_daily_day_idx" ON "support_metric_daily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "support_metric_daily_organizationId_day_key" ON "support_metric_daily"("organizationId", "day");

-- CreateIndex
CREATE INDEX "audit_log_actorId_createdAt_idx" ON "audit_log"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_organizationId_kind_createdAt_idx" ON "audit_log"("organizationId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_targetRef_idx" ON "audit_log"("targetRef");

-- CreateIndex
CREATE INDEX "audit_log_ticketId_createdAt_idx" ON "audit_log"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "support_job_run_kind_status_createdAt_idx" ON "support_job_run"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "support_job_run_requestedById_createdAt_idx" ON "support_job_run"("requestedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_profile_userId_key" ON "onboarding_profile"("userId");

-- CreateIndex
CREATE INDEX "brand_profile_organizationId_idx" ON "brand_profile"("organizationId");

-- CreateIndex
CREATE INDEX "file_asset_ownerId_createdAt_idx" ON "file_asset"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "file_asset_organizationId_idx" ON "file_asset"("organizationId");

-- CreateIndex
CREATE INDEX "project_milestone_projectId_orderIndex_idx" ON "project_milestone"("projectId", "orderIndex");

-- CreateIndex
CREATE INDEX "project_milestone_dueAt_idx" ON "project_milestone"("dueAt");

-- CreateIndex
CREATE INDEX "approval_request_projectId_status_idx" ON "approval_request"("projectId", "status");

-- CreateIndex
CREATE INDEX "approval_request_status_dueAt_idx" ON "approval_request"("status", "dueAt");

-- CreateIndex
CREATE INDEX "approval_response_approvalId_idx" ON "approval_response"("approvalId");

-- CreateIndex
CREATE INDEX "change_request_projectId_status_idx" ON "change_request"("projectId", "status");

-- CreateIndex
CREATE INDEX "project_comment_projectId_createdAt_idx" ON "project_comment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "project_file_projectId_createdAt_idx" ON "project_file"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "maintenance_subscription_organizationId_status_idx" ON "maintenance_subscription"("organizationId", "status");

-- CreateIndex
CREATE INDEX "maintenance_request_subscriptionId_status_idx" ON "maintenance_request"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "maintenance_request_requesterId_createdAt_idx" ON "maintenance_request"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "maintenance_report_subscriptionId_periodStart_idx" ON "maintenance_report"("subscriptionId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "billing_profile_organizationId_key" ON "billing_profile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_quoteNumber_key" ON "quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "quote_organizationId_status_idx" ON "quote"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_contractNumber_key" ON "contract"("contractNumber");

-- CreateIndex
CREATE INDEX "contract_organizationId_status_idx" ON "contract"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_invoiceNumber_key" ON "invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoice_organizationId_status_idx" ON "invoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "invoice_dueAt_idx" ON "invoice"("dueAt");

-- CreateIndex
CREATE INDEX "invoice_item_invoiceId_orderIndex_idx" ON "invoice_item"("invoiceId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotencyKey_key" ON "payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_invoiceId_idx" ON "payment"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_attempt_paymentId_idx" ON "payment_attempt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "support_ticket_ticketNumber_key" ON "support_ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_ticket_organizationId_status_idx" ON "support_ticket"("organizationId", "status");

-- CreateIndex
CREATE INDEX "support_ticket_requesterId_createdAt_idx" ON "support_ticket"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_message_ticketId_createdAt_idx" ON "ticket_message"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_attachment_ticketId_idx" ON "ticket_attachment"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "help_article_slug_key" ON "help_article"("slug");

-- CreateIndex
CREATE INDEX "help_article_category_idx" ON "help_article"("category");

-- CreateIndex
CREATE INDEX "help_article_status_publishedAt_idx" ON "help_article"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_userId_key" ON "notification_preference"("userId");

-- CreateIndex
CREATE INDEX "data_export_job_userId_requestedAt_idx" ON "data_export_job"("userId", "requestedAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_challenge" ADD CONSTRAINT "auth_challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_code" ADD CONSTRAINT "otp_code_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_code" ADD CONSTRAINT "otp_code_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "auth_challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_code" ADD CONSTRAINT "recovery_code_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_code_use" ADD CONSTRAINT "recovery_code_use_recoveryCodeId_fkey" FOREIGN KEY ("recoveryCodeId") REFERENCES "recovery_code"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_code_use" ADD CONSTRAINT "recovery_code_use_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "auth_challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_device" ADD CONSTRAINT "login_device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_alert" ADD CONSTRAINT "security_alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profile" ADD CONSTRAINT "customer_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profile" ADD CONSTRAINT "customer_profile_referralSourceId_fkey" FOREIGN KEY ("referralSourceId") REFERENCES "referral_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profile" ADD CONSTRAINT "customer_profile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_membership" ADD CONSTRAINT "account_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document" ADD CONSTRAINT "legal_document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "legal_document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_version" ADD CONSTRAINT "legal_document_version_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "legal_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consent" ADD CONSTRAINT "user_consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consent" ADD CONSTRAINT "user_consent_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "legal_document_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_assignment" ADD CONSTRAINT "support_assignment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_assignment" ADD CONSTRAINT "support_assignment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_assignment" ADD CONSTRAINT "support_assignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_note" ADD CONSTRAINT "internal_note_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_note" ADD CONSTRAINT "internal_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_event" ADD CONSTRAINT "escalation_event_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_event" ADD CONSTRAINT "escalation_event_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policy" ADD CONSTRAINT "sla_policy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canned_response" ADD CONSTRAINT "canned_response_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_support_profile" ADD CONSTRAINT "organization_support_profile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_support_profile" ADD CONSTRAINT "organization_support_profile_lastTouchedById_fkey" FOREIGN KEY ("lastTouchedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activity_log" ADD CONSTRAINT "customer_activity_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activity_log" ADD CONSTRAINT "customer_activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revision" ADD CONSTRAINT "content_revision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "help_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revision" ADD CONSTRAINT "content_revision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_feedback" ADD CONSTRAINT "knowledge_feedback_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "help_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_feedback" ADD CONSTRAINT "knowledge_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_attachment" ADD CONSTRAINT "article_attachment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "help_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_attachment" ADD CONSTRAINT "article_attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_metric_daily" ADD CONSTRAINT "support_metric_daily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_job_run" ADD CONSTRAINT "support_job_run_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_profile" ADD CONSTRAINT "onboarding_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profile" ADD CONSTRAINT "brand_profile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_asset" ADD CONSTRAINT "file_asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_asset" ADD CONSTRAINT "file_asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestone" ADD CONSTRAINT "project_milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_response" ADD CONSTRAINT "approval_response_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "approval_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_response" ADD CONSTRAINT "approval_response_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment" ADD CONSTRAINT "project_comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment" ADD CONSTRAINT "project_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_file" ADD CONSTRAINT "project_file_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_file" ADD CONSTRAINT "project_file_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_subscription" ADD CONSTRAINT "maintenance_subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_subscription" ADD CONSTRAINT "maintenance_subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "maintenance_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "maintenance_subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_report" ADD CONSTRAINT "maintenance_report_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "maintenance_subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_profile" ADD CONSTRAINT "billing_profile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempt" ADD CONSTRAINT "payment_attempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachment" ADD CONSTRAINT "ticket_attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachment" ADD CONSTRAINT "ticket_attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_article" ADD CONSTRAINT "help_article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_job" ADD CONSTRAINT "data_export_job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

