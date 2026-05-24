-- CreateEnum
CREATE TYPE "InstructorEventModerationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "InstructorEventTitle" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorEventTitle_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InstructorEvent" ADD COLUMN "titleId" TEXT,
ADD COLUMN "moderationStatus" "InstructorEventModerationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "rejectNote" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Migrate legacy status column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InstructorEvent' AND column_name = 'status'
  ) THEN
    UPDATE "InstructorEvent"
    SET "moderationStatus" = CASE
      WHEN "status"::text = 'PUBLISHED' THEN 'PUBLISHED'::"InstructorEventModerationStatus"
      WHEN "status"::text = 'ARCHIVED' THEN 'ARCHIVED'::"InstructorEventModerationStatus"
      ELSE 'DRAFT'::"InstructorEventModerationStatus"
    END;
    ALTER TABLE "InstructorEvent" DROP COLUMN "status";
  END IF;
END $$;

-- Backfill publishedAt for already published rows
UPDATE "InstructorEvent"
SET "publishedAt" = COALESCE("updatedAt", "createdAt")
WHERE "moderationStatus" = 'PUBLISHED' AND "publishedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InstructorEventTitle_instructorId_title_key" ON "InstructorEventTitle"("instructorId", "title");
CREATE INDEX "InstructorEventTitle_instructorId_idx" ON "InstructorEventTitle"("instructorId");
CREATE INDEX "InstructorEvent_instructorId_moderationStatus_createdAt_idx" ON "InstructorEvent"("instructorId", "moderationStatus", "createdAt");
CREATE INDEX "InstructorEvent_titleId_idx" ON "InstructorEvent"("titleId");

-- AddForeignKey
ALTER TABLE "InstructorEventTitle" ADD CONSTRAINT "InstructorEventTitle_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstructorEvent" ADD CONSTRAINT "InstructorEvent_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "InstructorEventTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old index if exists
DROP INDEX IF EXISTS "InstructorEvent_instructorId_status_createdAt_idx";

-- Drop old enum if exists
DROP TYPE IF EXISTS "InstructorEventStatus";
