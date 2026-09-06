-- Dos condiciones del mismo servicio no pueden regir a la vez.
--
-- La aplicacion ya lo valida y devuelve un mensaje entendible, pero esta
-- restriccion lo vuelve imposible aunque haya un bug, una condicion de carrera
-- entre dos pedidos simultaneos, o una escritura manual contra la base.
--
-- El rango es [validFrom, validTo) y un validTo nulo se trata como infinito,
-- que es exactamente la semantica de "sigue vigente".
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "service_conditions"
  ADD CONSTRAINT "service_conditions_sin_solapamiento"
  EXCLUDE USING gist (
    "serviceId" WITH =,
    daterange("validFrom", COALESCE("validTo", 'infinity'::date), '[)') WITH &&
  );

-- Un rango que termina antes de empezar, o que dura cero dias, no tiene sentido.
ALTER TABLE "service_conditions"
  ADD CONSTRAINT "service_conditions_rango_valido"
  CHECK ("validTo" IS NULL OR "validTo" > "validFrom");

-- El dia de vencimiento tiene que ser un dia posible del mes.
ALTER TABLE "service_conditions"
  ADD CONSTRAINT "service_conditions_dia_vencimiento_valido"
  CHECK (
    ("dueDayOfMonth" IS NULL OR ("dueDayOfMonth" BETWEEN 1 AND 31)) AND
    ("secondDueDayOfMonth" IS NULL OR ("secondDueDayOfMonth" BETWEEN 1 AND 31))
  );

-- Un monto negativo no es un monto.
ALTER TABLE "service_conditions"
  ADD CONSTRAINT "service_conditions_monto_no_negativo"
  CHECK ("baseAmount" IS NULL OR "baseAmount" >= 0);

-- La baja de un servicio no puede ser anterior a su alta.
ALTER TABLE "services"
  ADD CONSTRAINT "services_fechas_coherentes"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
