-- Претензии по качеству урока (синхронизация с refund-policy.ts §2.5)
ALTER TABLE "Order" ADD COLUMN "qualityClaimCategory" TEXT;
ALTER TABLE "Order" ADD COLUMN "qualityClaimDescription" TEXT;
ALTER TABLE "Order" ADD COLUMN "qualityClaimedAt" TIMESTAMP(3);
