-- CreateEnum
CREATE TYPE "LeadGrade" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'MEETING', 'CLOSED');

-- CreateTable
CREATE TABLE "AxCheckResponse" (
    "id" TEXT NOT NULL,
    "refCode" TEXT,
    "company" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "answers" JSONB NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "grade" "LeadGrade" NOT NULL,
    "score" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "resultToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxCheckResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AxCheckResponse_resultToken_key" ON "AxCheckResponse"("resultToken");

-- CreateIndex
CREATE INDEX "AxCheckResponse_grade_createdAt_idx" ON "AxCheckResponse"("grade", "createdAt");

-- CreateIndex
CREATE INDEX "AxCheckResponse_status_idx" ON "AxCheckResponse"("status");

-- CreateIndex
CREATE INDEX "AxCheckResponse_refCode_idx" ON "AxCheckResponse"("refCode");

-- CreateIndex
CREATE INDEX "AxCheckResponse_email_idx" ON "AxCheckResponse"("email");
