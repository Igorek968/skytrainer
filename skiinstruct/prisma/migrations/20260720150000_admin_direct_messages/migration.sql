-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminDirectMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminDirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminDirectMessage_recipientId_createdAt_idx" ON "AdminDirectMessage"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminDirectMessage_senderId_createdAt_idx" ON "AdminDirectMessage"("senderId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AdminDirectMessage" ADD CONSTRAINT "AdminDirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AdminDirectMessage" ADD CONSTRAINT "AdminDirectMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
