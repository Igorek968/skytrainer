-- Venue / address for instructor events
ALTER TABLE "InstructorEvent" ADD COLUMN "venueAddress" TEXT;
ALTER TABLE "InstructorEvent" ADD COLUMN "venueLat" DOUBLE PRECISION;
ALTER TABLE "InstructorEvent" ADD COLUMN "venueLng" DOUBLE PRECISION;
