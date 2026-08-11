-- AlterEnum
ALTER TYPE "ComplianceDocType" ADD VALUE 'PASSPORT';

-- AlterTable
ALTER TABLE "InstructorProfile" ADD COLUMN "passportSeries" TEXT,
ADD COLUMN "passportNumber" TEXT,
ADD COLUMN "passportIssuedAt" TIMESTAMP(3),
ADD COLUMN "passportDepartmentCode" TEXT;
