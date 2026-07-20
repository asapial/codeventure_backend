-- AlterTable: add optimistic-locking version on approval_request.
ALTER TABLE "approval_request"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: store change-request impact as MEDIUM by default.
ALTER TABLE "change_request"
  ADD COLUMN "impact" TEXT DEFAULT 'MEDIUM';
