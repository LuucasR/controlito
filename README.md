# Controlito

Control de servicios recurrentes, facturas, pagos, deudas y gastos proyectados.

No es una app de registro manual de gastos: registra las **condiciones pactadas** de cada
servicio, las **facturas y pagos reales**, detecta **diferencias** y **proyecta** lo que vas
a necesitar el mes que viene.

## Estructura

```
apps/
  api/     NestJS + TypeScript + Prisma + PostgreSQL
  app/     Flutter (Android, Web, iOS)   <- Etapa 0, en curso
docs/adr/  decisiones arquitectonicas
```

## Requisitos

| Herramienta | Version | Estado |
|---|---|---|
| Node.js | >= 22 | v24.18.0 |
| pnpm | >= 10 | 11.20.0 |
| Flutter | stable | `C:\Users\Lucas\dev\flutter` |
| PostgreSQL | 17 | Neon, region US East (Ohio) |

## Puesta en marcha

```bash
pnpm install
pnpm db:generate

cp apps/api/.env.example apps/api/.env   # completar DATABASE_URL y DIRECT_URL
pnpm dev                                  # http://localhost:3000/api/v1
```

## Verificacion

```bash
pnpm lint        # incluye la regla que impide que domain/ dependa de Nest o Prisma
pnpm typecheck
pnpm test        # unit del motor financiero (umbral 95%)
pnpm test:e2e    # HTTP end to end
pnpm build
```

## Base de datos y tests

Los tests e2e **crean y borran usuarios**, asi que corren contra una base
aparte, declarada en `E2E_DATABASE_URL`. Produccion nunca define esa variable,
de modo que no hay manera de que los tests toquen sus datos por descuido: si
falta, esas suites se saltean.

Para habilitarlas hace falta una branch de Neon dedicada (Branches > New Branch,
por ejemplo `dev`) y pegar sus dos cadenas en `apps/api/.env`. Para que
tambien corran en CI, cargar los mismos valores como secretos del repositorio
(`E2E_DATABASE_URL` y `E2E_DIRECT_URL`).

## Detalles conocidos en Windows

`prisma generate` falla con `EPERM ... query_engine-windows.dll.node` si hay un
`pnpm dev` corriendo: el proceso tiene tomado el motor de Prisma y Windows no
deja reemplazar el archivo. Se soluciona parando el servidor de desarrollo antes
de regenerar el cliente o de correr una migracion. En Linux (CI y Render) no pasa.

## Reglas del proyecto

1. **El dinero nunca es `number`/`double`.** `NUMERIC(20,4)` en Postgres, `Decimal` en
   TypeScript y Dart, **string** en JSON.
2. **Las fechas de vencimiento son `DATE`**, no timestamps. Se transportan como
   `"2026-09-10"`. Los instantes de auditoria son `TIMESTAMPTZ` en UTC.
3. **`src/domain/` es puro**: sin NestJS, sin Prisma, sin `new Date()`. Lo verifica ESLint.
4. **Los hechos financieros son inmutables**: una factura o un pago no se editan ni se
   borran, se anulan o se revierten con un asiento contrario.
5. **Lo estimado nunca se presenta como real.** Si una regla no esta configurada, se
   muestra `?`, nunca `$0`.

## Deploy

El backend se despliega en **Render** (region Ohio) mediante `render.yaml`, y la base
de datos es **Neon** en **US East (Ohio)**, co-ubicada con el backend. El razonamiento esta en
`docs/adr/0001-hosting-y-base-de-datos.md`.

El plan completo (modelo de datos, formulas del dashboard, casos borde y roadmap) esta en
`docs/PLAN.md`.
