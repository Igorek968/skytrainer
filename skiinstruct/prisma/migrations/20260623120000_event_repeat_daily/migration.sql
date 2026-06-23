-- Daily auto-repost for published instructor events
ALTER TABLE "InstructorEvent" ADD COLUMN "repeatDaily" BOOLEAN NOT NULL DEFAULT false;
