-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('AMOUNT_INCREASE', 'AMOUNT_DECREASE', 'DUE_DATE_CHANGED', 'DEBT_DETECTED', 'MISSING_INVOICE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'DISMISSED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "externalNumber" TEXT,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "secondDueDate" DATE,
    "currency" CHAR(3) NOT NULL,
    "totalAmount" DECIMAL(20,4) NOT NULL,
    "currentChargeAmount" DECIMAL(20,4) NOT NULL,
    "includedPriorDebtAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "priorDebtInterestAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "otherChargesAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "isEstimatedByProvider" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "voidedAt" TIMESTAMPTZ(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "serviceId" UUID,
    "cycleId" UUID,
    "invoiceId" UUID,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "baselineValue" DECIMAL(20,4),
    "observedValue" DECIMAL(20,4),
    "deltaAbsolute" DECIMAL(20,4),
    "deltaPercent" DECIMAL(12,4),
    "dedupeKey" TEXT NOT NULL,
    "detectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_userId_dueDate_idx" ON "invoices"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_cycleId_status_idx" ON "invoices"("cycleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_id_userId_key" ON "invoices"("id", "userId");

-- CreateIndex
CREATE INDEX "alerts_userId_status_detectedAt_idx" ON "alerts"("userId", "status", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_userId_dedupeKey_key" ON "alerts"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_serviceId_userId_fkey" FOREIGN KEY ("serviceId", "userId") REFERENCES "services"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cycleId_userId_fkey" FOREIGN KEY ("cycleId", "userId") REFERENCES "billing_cycles"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_invoiceId_userId_fkey" FOREIGN KEY ("invoiceId", "userId") REFERENCES "invoices"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
