-- Push-напоминания за ~1 ч до мероприятия
ALTER TABLE "InstructorEvent" ADD COLUMN IF NOT EXISTS "startReminderSentAt" TIMESTAMP(3);
ALTER TABLE "EventSlot" ADD COLUMN IF NOT EXISTS "startReminderSentAt" TIMESTAMP(3);
ALTER TABLE "EventRegistration" ADD COLUMN IF NOT EXISTS "eventStartReminderSentAt" TIMESTAMP(3);
