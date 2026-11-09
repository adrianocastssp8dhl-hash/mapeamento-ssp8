# Mapeamento Geral

Portuguese warehouse product-scanning workspace imported from the Google Sheets workbook “Mapeamento Geral”.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (use managed workflow for its assigned port)
- `pnpm --filter @workspace/mapeamento run dev` — frontend (use its managed workflow for PORT and BASE_PATH)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mapeamento/` — responsive React frontend
- `artifacts/api-server/src/routes/` — collaborators, scans, live totals, unified products
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/` — PostgreSQL schema

## Architecture decisions

- Sheets is an initial read-only import, not a two-way synchronization. App edits only affect PostgreSQL.
- The source workbook contains ten collaborator names and no product/scan records. Import those ten collaborators without fictional scans. Blank IDs with a quantity of zero are spreadsheet summary placeholders, not records.
- Consolidated and unified spreadsheet tabs are derived views, not independent copies of scan data. Compute them from scans.
- Product IDs are text so leading zeros remain intact. Calendar filters and daily totals use America/Sao_Paulo.

## Product

- View, search and filter bipagens; create, inspect, edit and delete scans.
- Manage collaborators; deletion is blocked when associated scans exist.
- Live overview, collaborator totals, unified product counts.
- Responsive pt-BR interface with real database persistence.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Regenerate clients and validators after changing OpenAPI. Keep generated query options pinned to the installed React Query major.
- Run the API and web managed workflows rather than starting root-level dev commands.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
