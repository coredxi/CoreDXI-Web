CREATE TYPE "FollowupStatus" AS ENUM ('SCHEDULED','HELD','SENDING','SENT','FAILED','SKIPPED');
ALTER TABLE "AxCheckResponse"
  ADD COLUMN "followupStatus" "FollowupStatus" NOT NULL DEFAULT 'SKIPPED',
  ADD COLUMN "followupScheduledAt" TIMESTAMP(3),
  ADD COLUMN "followupSentAt" TIMESTAMP(3),
  ADD COLUMN "followupSubject" TEXT,
  ADD COLUMN "followupBody" TEXT,
  ADD COLUMN "followupError" TEXT,
  ADD COLUMN "followupAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "t0SentAt" TIMESTAMP(3);
ALTER TABLE "AxCheckResponse" ALTER COLUMN "followupStatus" SET DEFAULT 'SCHEDULED';
CREATE INDEX "AxCheckResponse_followupStatus_followupScheduledAt_idx"
  ON "AxCheckResponse"("followupStatus", "followupScheduledAt");
