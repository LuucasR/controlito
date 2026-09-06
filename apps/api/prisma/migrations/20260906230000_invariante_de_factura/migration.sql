-- El total de una factura tiene que ser exactamente la suma de sus partes.
--
-- Es la invariante que hace confiable toda la comparacion: si el cargo del
-- periodo no cuadra con el total, cualquier deteccion de aumento estaria
-- comparando contra un numero inventado.
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_total_es_suma_de_partes"
  CHECK (
    "totalAmount" = "currentChargeAmount"
                  + "includedPriorDebtAmount"
                  + "priorDebtInterestAmount"
                  + "otherChargesAmount"
  );

-- Ningun componente puede ser negativo.
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_montos_no_negativos"
  CHECK (
    "currentChargeAmount" >= 0 AND
    "includedPriorDebtAmount" >= 0 AND
    "priorDebtInterestAmount" >= 0 AND
    "otherChargesAmount" >= 0
  );

-- Una factura no puede vencer antes de haber sido emitida.
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_fechas_coherentes"
  CHECK ("secondDueDate" IS NULL OR "secondDueDate" >= "dueDate");

-- UN SOLO documento vigente por periodo. Las anuladas quedan, pero no cuentan.
CREATE UNIQUE INDEX "invoices_una_vigente_por_ciclo"
  ON "invoices" ("cycleId") WHERE "status" = 'ISSUED';
