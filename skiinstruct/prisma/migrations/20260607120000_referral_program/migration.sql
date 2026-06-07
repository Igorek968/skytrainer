-- Referral program: codes, balance, rewards, payout requests.

ALTER TABLE "User"
ADD COLUMN "referralCode" TEXT,
ADD COLUMN "referredById" TEXT,
ADD COLUMN "referralBalanceRub" DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN "payoutAccountHint" TEXT;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

ALTER TABLE "User"
ADD CONSTRAINT "User_referredById_fkey"
FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD COLUMN "referralCreditAppliedRub" DECIMAL(10, 2),
ADD COLUMN "referralCreditSpent" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredClientId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountRub" DECIMAL(10, 2) NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralReward_orderId_key" ON "ReferralReward"("orderId");
CREATE INDEX "ReferralReward_referrerId_idx" ON "ReferralReward"("referrerId");
CREATE INDEX "ReferralReward_referredClientId_idx" ON "ReferralReward"("referredClientId");

ALTER TABLE "ReferralReward"
ADD CONSTRAINT "ReferralReward_referrerId_fkey"
FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralReward"
ADD CONSTRAINT "ReferralReward_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReferralPayoutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountRub" DECIMAL(10, 2) NOT NULL,
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPayoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReferralPayoutRequest_userId_status_idx" ON "ReferralPayoutRequest"("userId", "status");

ALTER TABLE "ReferralPayoutRequest"
ADD CONSTRAINT "ReferralPayoutRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
