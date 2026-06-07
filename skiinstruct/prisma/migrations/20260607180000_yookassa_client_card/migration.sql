-- AlterTable
ALTER TABLE "User" ADD COLUMN "yookassaPaymentMethodId" TEXT;
ALTER TABLE "User" ADD COLUMN "yookassaCardLast4" TEXT;
ALTER TABLE "User" ADD COLUMN "yookassaCardBrand" TEXT;
ALTER TABLE "User" ADD COLUMN "yookassaPendingBindId" TEXT;
ALTER TABLE "User" ADD COLUMN "mockCardBoundAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_yookassaPaymentMethodId_key" ON "User"("yookassaPaymentMethodId");
