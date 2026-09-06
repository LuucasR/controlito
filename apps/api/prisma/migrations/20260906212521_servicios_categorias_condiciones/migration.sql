-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'ON_DEMAND');

-- CreateEnum
CREATE TYPE "AmountMode" AS ENUM ('FIXED', 'VARIABLE_ESTIMATED', 'VARIABLE_UNKNOWN');

-- CreateEnum
CREATE TYPE "DueDayPolicy" AS ENUM ('CLAMP_TO_LAST_DAY', 'ROLL_FORWARD', 'FROM_INVOICE_ONLY');

-- CreateEnum
CREATE TYPE "DebtPolicy" AS ENUM ('ACCUMULATES_INTO_NEXT_INVOICE', 'PAID_SEPARATELY', 'NO_DEBT_SERVICE_CUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InterestModel" AS ENUM ('NONE', 'MONTHLY_PERCENT', 'DAILY_PERCENT', 'FIXED_FEE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "colorHex" CHAR(7),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "categoryId" UUID,
    "name" TEXT NOT NULL,
    "providerName" TEXT,
    "accountNumber" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" CHAR(3) NOT NULL DEFAULT 'ARS',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "debtPolicy" "DebtPolicy" NOT NULL DEFAULT 'UNKNOWN',
    "debtParams" JSONB,
    "autoDebit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_conditions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "amountMode" "AmountMode" NOT NULL DEFAULT 'VARIABLE_ESTIMATED',
    "baseAmount" DECIMAL(20,4),
    "frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "periodAnchorDate" DATE NOT NULL,
    "dueDayOfMonth" INTEGER,
    "dueDayPolicy" "DueDayPolicy" NOT NULL DEFAULT 'CLAMP_TO_LAST_DAY',
    "secondDueDayOfMonth" INTEGER,
    "secondDueSurcharge" DECIMAL(9,4),
    "interestModel" "InterestModel" NOT NULL DEFAULT 'UNKNOWN',
    "interestParams" JSONB,
    "changeReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_userId_archivedAt_idx" ON "categories"("userId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_slug_key" ON "categories"("userId", "slug");

-- CreateIndex
CREATE INDEX "services_userId_status_archivedAt_idx" ON "services"("userId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "services_userId_categoryId_idx" ON "services"("userId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "services_id_userId_key" ON "services"("id", "userId");

-- CreateIndex
CREATE INDEX "service_conditions_serviceId_validFrom_validTo_idx" ON "service_conditions"("serviceId", "validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "service_conditions_serviceId_validFrom_key" ON "service_conditions"("serviceId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "service_conditions_id_userId_key" ON "service_conditions"("id", "userId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_conditions" ADD CONSTRAINT "service_conditions_serviceId_userId_fkey" FOREIGN KEY ("serviceId", "userId") REFERENCES "services"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
