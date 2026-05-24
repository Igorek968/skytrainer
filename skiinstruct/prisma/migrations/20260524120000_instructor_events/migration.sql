-- CreateEnum
CREATE TYPE "InstructorEventStatus" AS ENUM ('PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "InstructorEvent" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "orderId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3),
    "status" "InstructorEventStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstructorEvent_instructorId_status_createdAt_idx" ON "InstructorEvent"("instructorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "InstructorEvent_orderId_idx" ON "InstructorEvent"("orderId");

-- AddForeignKey
ALTER TABLE "InstructorEvent" ADD CONSTRAINT "InstructorEvent_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorEvent" ADD CONSTRAINT "InstructorEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
