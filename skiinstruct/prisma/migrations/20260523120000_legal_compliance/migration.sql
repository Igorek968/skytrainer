-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'COMPLETED', 'FAILED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "OrderCancelledBy" AS ENUM ('CLIENT', 'INSTRUCTOR', 'PLATFORM', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ComplianceDocType" AS ENUM ('TAX_STATUS_NPD', 'TAX_STATUS_IP', 'INSURANCE');

-- CreateEnum
CREATE TYPE "ComplianceDocStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InstructorTaxStatus" AS ENUM ('SELF_EMPLOYED', 'IP');

-- AlterTable
ALTER TABLE "InstructorProfile" ADD COLUMN "agencyOfferAcceptedAt" TIMESTAMP(3),
ADD COLUMN "agencyOfferVersion" TEXT DEFAULT '2026-05-13',
ADD COLUMN "taxStatus" "InstructorTaxStatus",
ADD COLUMN "inn" TEXT,
ADD COLUMN "payoutAccountHint" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "payoutEligibleAt" TIMESTAMP(3),
ADD COLUMN "cancelledBy" "OrderCancelledBy",
ADD COLUMN "refundPercent" INTEGER,
ADD COLUMN "refundAmount" DECIMAL(10,2),
ADD COLUMN "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "refundNote" TEXT,
ADD COLUMN "lateRefundClaimedAt" TIMESTAMP(3),
ADD COLUMN "npdReceiptUrl" TEXT,
ADD COLUMN "npdReceiptUploadedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InstructorComplianceDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ComplianceDocType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "ComplianceDocStatus" NOT NULL DEFAULT 'PENDING',
    "rejectNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstructorComplianceDocument_userId_type_idx" ON "InstructorComplianceDocument"("userId", "type");

-- AddForeignKey
ALTER TABLE "InstructorComplianceDocument" ADD CONSTRAINT "InstructorComplianceDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
