-- CreateEnum
CREATE TYPE "NewsletterSendType" AS ENUM ('IMMEDIATE', 'SCHEDULED', 'REVIEW_THEN_SEND');

-- CreateEnum
CREATE TYPE "NewsletterCadence" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "KeywordOperator" AS ENUM ('OR', 'AND', 'NOT');

-- CreateEnum
CREATE TYPE "ArticleOrigin" AS ENUM ('NAVER_API', 'RSS', 'MANUAL');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('COLLECTING', 'DRAFT', 'REVIEW_REQUESTED', 'APPROVED', 'SENDING', 'SENT', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN     "lastSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NewsletterCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectTemplate" TEXT NOT NULL,
    "sendType" "NewsletterSendType" NOT NULL DEFAULT 'REVIEW_THEN_SEND',
    "cadence" "NewsletterCadence" NOT NULL DEFAULT 'WEEKLY',
    "sendDayOfWeek" INTEGER,
    "sendHourKst" INTEGER NOT NULL DEFAULT 8,
    "activeFrom" TIMESTAMP(3) NOT NULL,
    "activeUntil" TIMESTAMP(3),
    "collectDays" INTEGER NOT NULL DEFAULT 7,
    "maxArticles" INTEGER NOT NULL DEFAULT 7,
    "templateKey" TEXT NOT NULL DEFAULT 'ax-weekly',
    "audience" TEXT NOT NULL DEFAULT 'subscribers',
    "internalRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerId" TEXT NOT NULL,
    "coManagerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterKeyword" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "group" INTEGER NOT NULL,
    "operator" "KeywordOperator" NOT NULL DEFAULT 'OR',
    "term" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "NewsletterKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSelectionRule" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NewsletterSelectionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "homepage" TEXT NOT NULL,
    "rssUrl" TEXT,
    "domain" TEXT NOT NULL,
    "trustWeight" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterCampaignSource" (
    "campaignId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "NewsletterCampaignSource_pkey" PRIMARY KEY ("campaignId","sourceId")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "urlNormalized" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "sourceId" TEXT,
    "sourceName" TEXT,
    "origin" "ArticleOrigin" NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "titleHash" TEXT NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterIssue" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "issueNo" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "intro" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'COLLECTING',
    "scheduledAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "editedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterIssueArticle" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "ruleScore" INTEGER NOT NULL,
    "llmScore" INTEGER,
    "llmReason" TEXT,
    "summary" TEXT,
    "indicatorScores" JSONB,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "editorNote" TEXT,

    CONSTRAINT "NewsletterIssueArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterDelivery" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "email" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "resendId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NewsletterDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsletterCampaign_isActive_idx" ON "NewsletterCampaign"("isActive");

-- CreateIndex
CREATE INDEX "NewsletterKeyword_campaignId_idx" ON "NewsletterKeyword"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSelectionRule_campaignId_indicator_key" ON "NewsletterSelectionRule"("campaignId", "indicator");

-- CreateIndex
CREATE UNIQUE INDEX "NewsSource_name_key" ON "NewsSource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "NewsSource_domain_key" ON "NewsSource"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_urlNormalized_key" ON "NewsArticle"("urlNormalized");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_titleHash_idx" ON "NewsArticle"("titleHash");

-- CreateIndex
CREATE INDEX "NewsletterIssue_status_scheduledAt_idx" ON "NewsletterIssue"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterIssue_campaignId_issueNo_key" ON "NewsletterIssue"("campaignId", "issueNo");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterIssueArticle_issueId_articleId_key" ON "NewsletterIssueArticle"("issueId", "articleId");

-- CreateIndex
CREATE INDEX "NewsletterDelivery_issueId_status_idx" ON "NewsletterDelivery"("issueId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterDelivery_issueId_email_key" ON "NewsletterDelivery"("issueId", "email");

-- AddForeignKey
ALTER TABLE "NewsletterKeyword" ADD CONSTRAINT "NewsletterKeyword_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSelectionRule" ADD CONSTRAINT "NewsletterSelectionRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterCampaignSource" ADD CONSTRAINT "NewsletterCampaignSource_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterCampaignSource" ADD CONSTRAINT "NewsletterCampaignSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterIssue" ADD CONSTRAINT "NewsletterIssue_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterIssueArticle" ADD CONSTRAINT "NewsletterIssueArticle_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "NewsletterIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterIssueArticle" ADD CONSTRAINT "NewsletterIssueArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterDelivery" ADD CONSTRAINT "NewsletterDelivery_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "NewsletterIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase Security Advisor "RLS Disabled in Public" 예방 — 20260707190000 마이그레이션과 같은 근거.
-- Prisma는 테이블 소유자 연결이라 RLS 영향을 받지 않고, 공개 anon 키의 PostgREST 접근만 막힌다.
ALTER TABLE "NewsletterCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterKeyword" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterSelectionRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterCampaignSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterIssueArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterDelivery" ENABLE ROW LEVEL SECURITY;