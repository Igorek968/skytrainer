-- Штраф инструктора за неявку / позднюю отмену (30% от суммы заявки).
ALTER TABLE "InstructorProfile" ADD COLUMN IF NOT EXISTS "platformPenaltyBalanceRub" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "instructorPenaltyAmount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "instructorPenaltyAppliedAt" TIMESTAMP(3);

ALTER TABLE "EventRegistration" ADD COLUMN IF NOT EXISTS "instructorNoShowRefundClaimedAt" TIMESTAMP(3);
ALTER TABLE "EventRegistration" ADD COLUMN IF NOT EXISTS "instructorPenaltyAmount" DECIMAL(10,2);
ALTER TABLE "EventRegistration" ADD COLUMN IF NOT EXISTS "instructorPenaltyAppliedAt" TIMESTAMP(3);

ALTER TABLE "InstructorPayoutRequest" ADD COLUMN IF NOT EXISTS "penaltyDeductedRub" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "InstructorPlatformPenalty" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "orderId" TEXT,
    "eventRegistrationId" TEXT,
    "baseAmountRub" DECIMAL(10,2) NOT NULL,
    "penaltyPercent" INTEGER NOT NULL,
    "amountRub" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "payoutRequestId" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorPlatformPenalty_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InstructorPlatformPenalty_instructorId_settledAt_idx" ON "InstructorPlatformPenalty"("instructorId", "settledAt");
CREATE INDEX IF NOT EXISTS "InstructorPlatformPenalty_orderId_idx" ON "InstructorPlatformPenalty"("orderId");
CREATE INDEX IF NOT EXISTS "InstructorPlatformPenalty_eventRegistrationId_idx" ON "InstructorPlatformPenalty"("eventRegistrationId");

DO $$ BEGIN
  ALTER TABLE "InstructorPlatformPenalty" ADD CONSTRAINT "InstructorPlatformPenalty_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorPlatformPenalty" ADD CONSTRAINT "InstructorPlatformPenalty_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorPlatformPenalty" ADD CONSTRAINT "InstructorPlatformPenalty_eventRegistrationId_fkey" FOREIGN KEY ("eventRegistrationId") REFERENCES "EventRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorPlatformPenalty" ADD CONSTRAINT "InstructorPlatformPenalty_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "InstructorPayoutRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
