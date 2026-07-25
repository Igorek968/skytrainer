-- CreateEnum
CREATE TYPE "AdminAlertCategory" AS ENUM ('MODERATION', 'MESSAGES', 'COMPLIANCE', 'FINANCE', 'ORDERS', 'CATALOG', 'USERS');

-- CreateTable
CREATE TABLE "AdminAlert" (
    "id" TEXT NOT NULL,
    "category" "AdminAlertCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "AdminAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminAlert_dedupeKey_key" ON "AdminAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "AdminAlert_createdAt_idx" ON "AdminAlert"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAlert_category_readAt_idx" ON "AdminAlert"("category", "readAt");

-- CreateIndex
CREATE INDEX "AdminAlert_readAt_createdAt_idx" ON "AdminAlert"("readAt", "createdAt");
