# ADR 0001 — Hosting del backend y ubicación de la base de datos

**Fecha:** 2026-09-06
**Estado:** aceptada

## Contexto

El backend se despliega en Render, por decisión explícita del usuario. Falta definir
dónde vive PostgreSQL. Los usuarios están en Argentina.

Datos verificados el 2026-09-06 en la documentación y el changelog de Render:

- Render tiene 5 regiones: Oregon, Ohio, Virginia, Frankfurt y Singapur.
  **No hay región en Sudamérica.**
- El PostgreSQL del plan free de Render **expira a los 30 días** de creado, con 14 días
  de gracia para pasarlo a un plan pago; después Render borra la base y sus datos.
  Límite: 1 GB y una sola base free por cuenta.
- El PostgreSQL pago de Render arranca en US$6/mes (Basic-256mb).
- El web service free se suspende tras 15 minutos sin tráfico; despertar tarda 30-60s.

## Decisión

- **Backend:** Render, región **Ohio** (`us-east-2`).
- **Base de datos:** **Neon**, región **US East (Ohio)** — la **misma** región que el backend.

## Corrección respecto del plan original

El plan recomendaba Neon en São Paulo (`sa-east-1`) "por latencia desde Argentina".
**Era un error.** La latencia que importa no es la del celular al backend, sino la del
backend a la base: un request del usuario cruza la distancia una sola vez, pero el
backend le hace varias consultas seguidas a la base, y cada una paga esa latencia.
Con el backend en Estados Unidos y la base en Brasil, todas esas consultas cruzan el
continente. La base va donde está el backend.

## Por qué Neon y no el PostgreSQL de Render

1. El free de Render se borra a los 30 días; el de Neon no expira.
2. Neon ofrece **branching copy-on-write en ~1 segundo**: una copia de la base por
   corrida de tests, lo que resuelve el entorno de pruebas sin instalar Docker
   (que no está instalado en la máquina de desarrollo).
3. Neon suspende por inactividad y despierta en cientos de milisegundos, mucho mejor
   que el arranque en frío de un servicio de Render.

Costo: dos paneles de administración en lugar de uno.

## Consecuencias

- ~150-200ms de latencia desde Buenos Aires hasta Ohio. Se mitiga por diseño:
  el dashboard se sirve en **una sola llamada** en vez de seis (ver §6 del plan).
- El cliente Flutter usa timeout de 60s y una UI de "Despertando el servidor…" para el
  arranque en frío del plan free. Producción debería ir a Starter (US$7/mes).
- `healthCheckPath` apunta a `/api/v1/health`, que **no toca la base**: si apuntara a
  `/health/ready`, Render reiniciaría el servicio cada vez que Neon se suspende.
- Si la latencia llegara a molestar, Fly.io tiene región `gru` (São Paulo, ~30ms) y el
  backend es portable: son un Dockerfile y las mismas variables de entorno.

## Alternativas descartadas

- **Todo en Render (web + Postgres):** un solo proveedor y la conexión enlazada
  automáticamente, pero implica US$6/mes desde el día 31 y no hay branching para tests.
- **Neon en São Paulo:** ver la corrección de arriba.
- **Supabase:** aporta Auth y Storage, que este proyecto no usa (auth propio, y los
  comprobantes se guardan en el dispositivo). Su pooler además tiene más fricción con Prisma.
