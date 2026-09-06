-- CreateEnum
CREATE TYPE "CycleLifecycle" AS ENUM ('PROJECTED', 'AWAITING_INVOICE', 'INVOICED', 'CLOSED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AmountSource" AS ENUM ('REAL_INVOICE', 'USER_FIXED', 'USER_ESTIMATE', 'LAST_INVOICE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "billing_cycles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "conditionId" UUID,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "dueDate" DATE,
    "dueDateSource" "AmountSource" NOT NULL DEFAULT 'USER_ESTIMATE',
    "projectedDueDate" DATE,
    "expectedAmount" DECIMAL(20,4),
    "expectedAmountSource" "AmountSource" NOT NULL DEFAULT 'USER_ESTIMATE',
    "expectedAmountLocked" BOOLEAN NOT NULL DEFAULT false,
    "currency" CHAR(3) NOT NULL DEFAULT 'ARS',
    "lifecycle" "CycleLifecycle" NOT NULL DEFAULT 'PROJECTED',
    "generationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "billing_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_cycles_userId_dueDate_lifecycle_idx" ON "billing_cycles"("userId", "dueDate", "lifecycle");

-- CreateIndex
CREATE INDEX "billing_cycles_serviceId_periodIndex_idx" ON "billing_cycles"("serviceId", "periodIndex");

-- CreateIndex
CREATE UNIQUE INDEX "billing_cycles_serviceId_periodStart_key" ON "billing_cycles"("serviceId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "billing_cycles_id_userId_key" ON "billing_cycles"("id", "userId");

-- AddForeignKey
ALTER TABLE "billing_cycles" ADD CONSTRAINT "billing_cycles_serviceId_userId_fkey" FOREIGN KEY ("serviceId", "userId") REFERENCES "services"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_cycles" ADD CONSTRAINT "billing_cycles_conditionId_userId_fkey" FOREIGN KEY ("conditionId", "userId") REFERENCES "service_conditions"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
