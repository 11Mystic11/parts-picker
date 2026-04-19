# Parts Partner — Master Reference

> Load this file at the start of any session: "read PARTS_PARTNER_MASTER.md before we continue"
> Working directory: `C:\Users\crbat\OneDrive\Documents\Antigravity\parts-picker`

---

## Project Identity

| Field | Value |
|-------|-------|
| App name | Parts Partner |
| Package name | `parts-partner` |
| Port | default Next.js (3000) |
| Live route prefix | `/dashboard/*` |
| Admin route prefix | `/dashboard/admin/*` |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.3 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Neon |
| ORM | Prisma v7 with `@prisma/adapter-pg` (WASM engine — **never** bare `new PrismaClient()`) |
| Auth | NextAuth.js JWT, CredentialsProvider, `bcryptjs` |
| UI | Tailwind CSS + shadcn/ui (`components/ui/`) |
| Charts | Recharts 3.x |
| File storage | `@vercel/blob` |
| AI | `@anthropic-ai/sdk` — Claude Haiku (`claude-haiku-4-5-20251001`) |
| PDF generation | PDFKit (server-side, `serverExternalPackages`) |

### Critical Prisma pattern
```ts
// lib/db.ts — always use this singleton, never bare PrismaClient
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
```

### DB commands
```bash
# Schema changes
npx prisma db push          # uses DATABASE_URL (direct postgres://)
npx prisma generate         # regenerate client after schema change
# PRISMA_CLI_DATABASE_URL = prisma+postgres:// (for CLI only)
# DATABASE_URL = postgresql:// (for app runtime)
```

### `next.config.ts` serverExternalPackages
```ts
serverExternalPackages: ["pdfkit", "pg", "@prisma/adapter-pg", "@anthropic-ai/sdk"]
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Direct `postgresql://` — app runtime |
| `PRISMA_CLI_DATABASE_URL` | `prisma+postgres://` — CLI only |
| `NEXTAUTH_SECRET` | NextAuth signing key |
| `NEXTAUTH_URL` | App base URL |
| `ANTHROPIC_API_KEY` | Claude API (document ingest) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage |

---

## Auth & Session Shape

```ts
// Session user shape (JWT callback in lib/auth.ts)
session.user = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "advisor" | "manager" | "developer";
  rooftopId: string;
  organizationId: string;
}

// Usage in API routes
const session = await getServerSession(authOptions);
const user = session.user as { id: string; rooftopId?: string; role?: string };
```

---

## Roles (RBAC)

| Role | Access |
|------|--------|
| `admin` | Full access — rules, users, pricing, all ROs |
| `manager` | All ROs for rooftop, pricing config, reports |
| `advisor` | Own ROs, VIN decode, maintenance browser |
| `developer` | Same as admin (internal) |

---

## Database Schema (key models)

```
Organization → Rooftop → User
Rooftop: laborRate, taxRate, shopSupplyPct, shopSupplyCap, oems (JSON string), currency, timezone

RepairOrder: rooftopId, advisorId, vin, vehicleSnapshot (JSON), currentMileage,
             status (draft|presented|approved|closed|void), wizardStep,
             partsSubtotal, laborSubtotal, shopSupplyFee, taxAmount, totalAmount

ROLineItem: repairOrderId, type (service|part|labor|fee|tax),
            source (recommended|otpr|manual), isAccepted,
            unitCost, unitPrice, totalPrice, partNumber, laborOpCode

MaintenanceSchedule: oem, mileageInterval, serviceDefinitions (JSON)
PartsCatalog: oem, partNumber, name, defaultCost, conditions (JSON), serviceIds (JSON), quantityRule, isKit, kitParts (JSON)
LaborOperation: oem, opCode, name, flatRateHours, serviceIds (JSON), conditions (JSON)
OTPRRule: oem, name, mileageThreshold, partNumbers (JSON), urgencyTier (urgent|suggested|informational), conditions (JSON)
PricingMatrix: rooftopId, tiers (JSON — [{minCost, maxCost, markupPct}])
VehicleCache: vin (unique), make, model, year, engine, drivetrain, trim, oem, rawData (JSON), expiresAt
IngestDocument: rooftopId, uploadedById, blobUrl, fileName, mimeType, status (pending|done|error), extractedData (JSON), errorMessage
AuditLog: userId, rooftopId, repairOrderId, action, entityType, entityId, diff (JSON)
```

---

## Completed Phases

### Phase 1 — Auth & Multi-Tenancy ✅
**Spec sections:** 1 (Core System Foundation), 16 (Security)
- NextAuth JWT with CredentialsProvider + bcrypt
- Organization → Rooftop → User hierarchy
- RBAC roles: admin, advisor, manager, developer
- Session includes `rooftopId`, `organizationId`, `role`
- Protected routes via `middleware.ts` (matcher: `/dashboard/:path*`)
- Rooftop config: labor rate, tax rate, shop supply %, OEM selections

**Key files:**
- `lib/auth.ts` — NextAuth config, JWT/session callbacks
- `middleware.ts` — route protection
- `prisma/schema.prisma` — Organization, Rooftop, User, Account, Session

---

### Phase 2 — VIN Intelligence Engine ✅
**Spec section:** 2
- VIN decode via NHTSA API (`https://vpic.api.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}`)
- Normalization layer: maps raw NHTSA fields → standardized `VehicleData` shape
- OEM inference from make (GM→GM, Ford→Ford, etc.)
- Caching in `VehicleCache` table (TTL: 30 days)
- Error handling for invalid/partial VINs (must be 17 chars, alphanumeric)

**Key files:**
- `lib/vin/decode.ts` — NHTSA fetch + cache logic
- `lib/vin/normalize.ts` — VehicleData type + normalization
- `app/api/vin/decode/route.ts` — `GET /api/vin/decode?vin=`

---

### Phase 3 — Maintenance Browser & RO Workflow ✅
**Spec sections:** 3, 8
- Mileage interval engine: rounds to nearest 5k, generates interval stack (5k, 10k, 15k…)
- `MaintenanceSchedule` lookup by OEM + interval
- Service definitions grouped: required vs recommended
- RO wizard (5 steps): VIN → Mileage → Services → Review → Present
- Step-gated navigation with `wizardStep` persisted on `RepairOrder`
- RO status flow: draft → presented → approved → closed | void
- PDF export (PDFKit) at `GET /api/ro/[id]/pdf`

**Key files:**
- `lib/maintenance/schedule.ts` — interval lookup, service grouping
- `app/api/maintenance/route.ts` — `GET /api/maintenance?vin=&mileage=`
- `app/api/ro/route.ts` — `POST /api/ro` (create draft)
- `app/api/ro/[id]/route.ts` — `GET/PATCH /api/ro/[id]`
- `app/api/ro/[id]/pdf/route.ts` — PDF generation
- `app/dashboard/ro/new/page.tsx` — RO wizard UI
- `app/dashboard/ro/[id]/page.tsx` — RO detail + step navigation

---

### Phase 4 — Parts, OTPR, Labor & Pricing Engines ✅
**Spec sections:** 4, 5, 6, 7

**Parts Engine:**
- `PartsCatalog` lookup by OEM + serviceIds
- Conditional filtering: engine, drivetrain, trim matching from vehicle snapshot
- Kit expansion: if `isKit`, expand to constituent `kitParts`
- Quantity rules: literal number or formula string

**OTPR System (One-Time Part Recommendations):**
- `OTPRRule` triggered when `mileage` is within ±15% of `mileageThreshold`
- Urgency tiers: urgent, suggested, informational
- Non-recurring: once triggered, advisor can dismiss

**Labor Engine:**
- `LaborOperation` lookup by OEM + serviceIds
- Flat-rate hours from OEM database
- Multiple ops combined into single labor subtotal

**Pricing Engine:**
- Parts markup via `PricingMatrix` tiers (tiered by cost bucket)
- Labor = `flatRateHours × rooftop.laborRate`
- Shop supply fee = `min(partsSubtotal × shopSupplyPct, shopSupplyCap)`
- Tax = `(partsSubtotal + laborSubtotal + shopSupplyFee) × taxRate`
- Default tiers if no `PricingMatrix` exists for rooftop

**Key files:**
- `lib/parts/recommend.ts` — parts lookup + filtering
- `lib/labor/lookup.ts` — labor op lookup
- `lib/pricing/calculate.ts` — full RO pricing aggregation
- `app/api/ro/calculate/route.ts` — `POST /api/ro/calculate`

---

### Phase 5 — Admin Panel & PDF Export ✅
**Spec section:** 11, part of 8

**Admin Panel** (`/dashboard/admin/`):
- Rules management: MaintenanceSchedule, PartsCatalog, LaborOperation, OTPRRule (full CRUD)
- Pricing config: PricingMatrix tiers editor per rooftop
- User management: create/edit users, assign roles and rooftop
- Rooftop settings: labor rate, tax rate, shop supply, OEM selections, timezone, currency

**PDF Export:**
- Server-side PDFKit rendering
- Print-ready RO with line items, totals, vehicle info, advisor name
- Served as `Content-Type: application/pdf` download

**Key files:**
- `app/dashboard/admin/` — admin page components
- `components/admin/rules-client.tsx` — rules CRUD UI
- `app/api/admin/` — admin API routes
- `app/api/ro/[id]/pdf/route.ts` — PDF endpoint

---

### Phase 6 — Document Ingest (OCR) ✅
**Spec section:** 9

- Upload zone: drag-and-drop or click-to-browse (PNG, JPG, WebP, PDF, max 10 MB)
- File stored in Vercel Blob (`ingest/{rooftopId}/{timestamp}-{filename}`)
- Claude Haiku vision extracts structured data from document image/PDF
- Extracted fields: documentType, VIN, year/make/model, mileage, services (line items), totals, confidence, rawNotes
- `IngestDocument` record persisted with status (`done` | `error`) and `extractedData` JSON
- UI shows extraction result: doc type badge, confidence badge, vehicle info, services table, totals
- "Start New RO" button → `/dashboard/ro/new?vin=&mileage=` pre-fills VIN wizard
- History table: last 20 uploads for rooftop

**Key files:**
- `lib/ingest/extract.ts` — Claude Haiku extraction logic (`extractFromDocument`)
- `app/api/ingest/upload/route.ts` — `POST /api/ingest/upload` (multipart)
- `app/api/ingest/route.ts` — `GET /api/ingest` (history)
- `app/dashboard/ingest/page.tsx` — full ingest UI

---

### Phase 7 — Analytics Dashboard ✅
**Spec section:** 15

- KPI cards: Revenue MTD, Avg RO Value, ROs This Month, Upsell Rate
- Area chart: revenue trend over last 30 days (day-by-day)
- Horizontal bar chart: RO count by advisor (top 8)
- Status breakdown: all-time RO counts by status (draft/presented/approved/closed/void)
- Advisor performance table: sortable by any column (ROs, revenue, avg value, upsell rate)
  - Color-coded upsell rate: green ≥70%, yellow ≥40%, red <40%
- CSV export: downloads advisor + trend data, no server round-trip
- All metrics scoped to session `rooftopId`
- Void ROs excluded from revenue; draft ROs counted in status breakdown

**Key files:**
- `app/api/analytics/route.ts` — `GET /api/analytics` aggregation
- `app/dashboard/analytics/page.tsx` — full analytics UI

---

## Remaining Phases

### Phase 8 — Cross-Rooftop UI & MFA ✅

**Spec sections:** §1

These two extend the same auth/tenancy layer — cross-rooftop adds org-level views and a rooftop switcher; MFA plugs into the same NextAuth pipeline. Building them separately would mean touching auth twice.

**Scope:**

- Org-level dashboard: see all rooftops, aggregate KPIs, drill-down navigation
- Rooftop switcher in sidebar nav (for users with access to multiple rooftops)
- `organizationId`-scoped API variants for manager/admin roles
- MFA via TOTP (authenticator app) — `UserMFA` schema model, setup flow, enforcement middleware
- Backup codes generated at MFA enrollment
- Admin can require MFA per rooftop

**New schema models:** `UserMFA { userId, secret, backupCodes, enabledAt }`

**Key files to create/modify:**

- `lib/mfa/totp.ts` — TOTP generate/verify
- `app/api/mfa/` — setup, verify, disable routes
- `app/dashboard/org/` — org-level pages
- `middleware.ts` — MFA enforcement check
- `components/layouts/dashboard-shell.tsx` — rooftop switcher

---

### Phase 9 — OEM Data Infrastructure ✅

**Spec sections:** §12, §13 (data pipelines)

You can't version what you can't reliably ingest. Ingestion pipelines and versioning are tightly coupled — build them apart and you rewrite. This phase makes the rule database production-grade.

**Scope:**

- Versioning on `MaintenanceSchedule`, `PartsCatalog`, `LaborOperation`, `OTPRRule` — add `version`, `effectiveDate`, `supersededBy` fields
- "Active" record resolver: always serves latest non-superseded version
- Bulk import CLI/UI: upload a structured JSON or CSV, validate against schema, insert as new version
- Import preview: diff view showing what changes before committing
- Rollback: reactivate previous version if current has errors
- Audit trail: who imported what version and when

**Schema additions:**

```
MaintenanceSchedule: + version Int, effectiveDate DateTime, supersededById Int?
PartsCatalog: + version Int, effectiveDate DateTime, supersededById Int?
LaborOperation: + version Int, effectiveDate DateTime, supersededById Int?
OTPRRule: + version Int, effectiveDate DateTime, supersededById Int?
ImportBatch: id, rooftopId, importedById, entityType, recordCount, status, errorLog (JSON), createdAt
```

**Schema additions (implemented):**

```
MaintenanceSchedule: + version Int, isActive Boolean, effectiveDate DateTime, importBatchId String?
                       @@unique([oem, mileageInterval, version])  ← was [oem, mileageInterval]
PartsCatalog:        + version Int, isActive Boolean, effectiveDate DateTime, importBatchId String?
                       @@unique([oem, partNumber, version])
LaborOperation:      + version Int, isActive Boolean, effectiveDate DateTime, importBatchId String?
                       @@unique([oem, opCode, version])
OTPRRule:            + version Int, isActive Boolean, effectiveDate DateTime, importBatchId String?
ImportBatch: id, importedById, entityType, recordCount, newCount, updatedCount, status, errorLog, createdAt
```

**Key files created:**

- `lib/oem/versioning.ts` — active record resolvers (`getActiveSchedules`, `getActiveParts`, `getActiveLabor`, `getActiveOTPR`), `rollbackBatch()`
- `lib/oem/import.ts` — Zod validators per entity type, `previewImport()` (dry-run diff), `commitImport()` (versioned transaction)
- `app/api/admin/import/route.ts` — `POST /api/admin/import` (`mode: "preview" | "commit"`)
- `app/api/admin/import/history/route.ts` — `GET /api/admin/import/history`
- `app/api/admin/import/rollback/route.ts` — `POST /api/admin/import/rollback`
- `app/dashboard/admin/import/page.tsx` — import UI: entity selector, JSON paste/upload, diff preview table, commit, history + rollback

**Active-record filter applied to:**

- `lib/maintenance/schedule.ts` → `isActive: true`
- `lib/parts/recommend.ts` → `isActive: true`
- `lib/labor/lookup.ts` → `isActive: true`
- All `app/api/admin/rules/*/route.ts` GET handlers → `isActive: true`
- All admin rules POST handlers → now create new version + deactivate old (no more bare `create/upsert`)

**DB migration note:** Run `npx prisma db push && npx prisma generate` once after pulling. Existing records auto-get `version=1, isActive=true` (default values). No data loss.

---

### Phase 10 — Tablet UX & Employee ID Enforcement ✅

**Spec sections:** §10, §14

Both touch the same surface layer — the RO workflow UI and PDF exports. ID-001 enforcement appears in the UI (badge display, login enforcement) and on generated documents. Addressing UX polish at the same time prevents a second pass over the same components.

**Scope:**

**Tablet UX (§10):**

- RO wizard reflow: touch-friendly step navigation, larger tap targets
- Line item rows: swipe-to-dismiss or expand on mobile/tablet
- Sidebar nav collapses to bottom tab bar on `md` and below
- Ingest upload: camera capture option on tablet (`accept="image/*;capture=environment"`)
- Analytics charts: responsive Recharts configs for narrow viewports

**ID-001 (§14):**

- `employeeId` field on `User` model (unique per organization)
- ID format enforced at user creation: `{ORG_PREFIX}-{4-digit-number}` (e.g. `TYT-0042`)
- Employee ID shown on RO PDF (replaces or supplements advisor name)
- Employee ID shown in advisor performance table in analytics
- Admin user management: assign/reassign IDs, enforce uniqueness

**Schema addition:**

```
User: + employeeId String? @unique (scoped per org at app layer)
```

**Key files to modify:**

**Implementation notes:**

- `prisma/schema.prisma` — `employeeId String?` on User with `@@unique([rooftopId, employeeId])`
- `lib/validators/employee-id.ts` — Zod schema: `/^[A-Z]{2,6}-\d{4}$/` (e.g. `TYT-0042`)
- `app/api/admin/users/route.ts` — validates and stores `employeeId` on create
- `app/api/ro/[id]/pdf/route.ts` — advisor line shows `Name (EMPID)` when ID exists
- `components/layouts/dashboard-shell.tsx` — `md:hidden` bottom tab bar with 5 priority routes
- `app/dashboard/ro/new/page.tsx` — Suspense-wrapped for `useSearchParams`, `px-4 md:px-6` responsive padding, min-h touch targets
- `app/dashboard/ingest/page.tsx` — `cameraInputRef` with `capture="environment"`, "Take Photo" button (`md:hidden`)
- `app/dashboard/analytics/page.tsx` — `ResponsiveContainer`, mobile card layout (`md:hidden`), employee IDs in advisor table
- TypeScript/lint fixes: Zod v4 `.issues` (not `.errors`), `z.record(z.string(), z.unknown())`, Base UI Select `null` guards, Prisma OR conditions for nullable flags

---

### Phase 11 — DMS Integrations ✅

**Spec section:** §13

Standalone, externally-dependent integration work. CDK and Reynolds have their own auth flows, rate limits, and data shapes. Isolated here so it doesn't destabilize the core RO workflow.

**Scope:**

- Abstraction layer: `lib/dms/adapter.ts` — `DMSAdapter` interface + `getDMSAdapter()` factory + AES-256-GCM credential encryption/decryption
- CDK Global adapter: OAuth2 client-credentials token fetch, full RO push mapping, graceful stub when `CDK_TOKEN_URL` env var absent
- Reynolds & Reynolds adapter: `X-API-Key` auth, same interface, graceful stub when `REYNOLDS_BASE_URL` absent
- DMS config per rooftop: provider + AES-256-GCM encrypted credential JSON in `Rooftop.dmsConfig`
- RO status transition state machine added to `PATCH /api/ro/[id]` — valid moves: draft→presented|void, presented→approved|void, approved→closed|void
- Auto-sync on approval: fire-and-forget `triggerDMSSync()` called when RO status transitions to `"approved"`
- Sync status on RO: `dmsSyncStatus` (pending | synced | failed), `dmsSyncedAt`, `dmsExternalId`, `dmsSyncAttempts` (already in schema)
- Manual re-sync: `POST /api/dms/sync` — admin/manager/developer only, accepts `dryRun` flag
- Retry queue: `GET /api/cron/dms-retry` — cron endpoint (15 min), retries `dmsSyncStatus=failed` ROs with `dmsSyncAttempts < 3`, logs exhaustion
- Admin UI: DMS config panel at `/dashboard/admin/dms` — provider selector, per-provider credential forms, masked existing creds display, test-connection button, sync health KPI cards
- RO list: DMS sync status column with `Pending/Synced/Failed` badges; `Failed` rows show inline re-sync button for admin/manager

**Schema additions (all already in DB — no migration needed):**

```
Rooftop:     dmsProvider String?, dmsConfig String? @db.Text (encrypted)
RepairOrder: dmsSyncStatus String?, dmsSyncedAt DateTime?, dmsExternalId String?, dmsSyncAttempts Int
```

**Key files created/modified:**

- `lib/dms/adapter.ts` — interface, factory, AES-256-GCM encrypt/decrypt helpers
- `lib/dms/cdk.ts` — CDK Global adapter (OAuth2)
- `lib/dms/reynolds.ts` — Reynolds & Reynolds adapter (API key)
- `app/api/ro/[id]/route.ts` — added status transitions + auto-sync hook
- `app/api/dms/sync/route.ts` — `POST /api/dms/sync` (manual sync)
- `app/api/cron/dms-retry/route.ts` — `GET /api/cron/dms-retry` (retry cron)
- `app/api/admin/dms/route.ts` — `GET/PATCH /api/admin/dms` (config)
- `app/dashboard/admin/dms/page.tsx` — admin DMS config UI
- `app/dashboard/ro/page.tsx` — added DMS status column + re-sync button
- `components/layouts/dashboard-shell.tsx` — added DMS Config nav entry

**New env vars needed:**

| Variable | Purpose |
|----------|---------|
| `CDK_TOKEN_URL` | CDK OAuth2 token endpoint |
| `CDK_SCOPE` | CDK OAuth2 scope (default: `ros:write`) |
| `CDK_BASE_URL` | CDK API base URL |
| `REYNOLDS_BASE_URL` | Reynolds API base URL |
| `CRON_SECRET` | Bearer token securing cron endpoint |

**Cron config (vercel.json):**
```json
{ "crons": [{ "path": "/api/cron/dms-retry", "schedule": "*/15 * * * *" }] }
```

---

### Phase 12 — CI/CD & Feature Flags ✅

**Spec section:** §17

Infrastructure capstone. Feature flags gate Phase 8–11 rollouts (MFA requirement, DMS sync, new UX). CI/CD locks in quality gates before any of this ships to production.

**Scope:**

**CI/CD:**

- GitHub Actions workflow: `typecheck → lint → build` on every push/PR (`ci` job)
- Schema drift job: spins up a Postgres service container on PRs, runs `prisma db push` against a fresh DB to catch drift early
- `npm run lint` + `npx tsc --noEmit` + `npm run build` quality gates
- Branch protection: PRs require passing checks before merge (configure in GitHub repo settings)

**Feature Flags:**

- Lightweight flag system: `FeatureFlag` table (`flagKey`, `rooftopId` nullable, `enabled`)
- `lib/flags/evaluate.ts` — `flagEnabled(key, rooftopId?)`, `setFlag()`, `getAllFlags()` helpers
  - Resolution order: rooftop override → global → default (false)
- Three flags shipped: `dms_sync`, `mfa_enforcement`, `tablet_ux`
- Admin UI at `/dashboard/admin/flags`: scope selector (global or per-rooftop), toggle per flag, scope badge
- Flags wired in:
  - `dms_sync`: `triggerDMSSync()` in `app/api/ro/[id]/route.ts` — skips live DMS push if off
  - `mfa_enforcement`: embedded in JWT at sign-in via `lib/auth.ts`, read in `middleware.ts` — disabling this flag allows all users through even if `rooftop.mfaRequired = true`

**Schema addition:**

```
FeatureFlag: id, flagKey String, rooftopId String? (null = global), enabled Boolean, updatedAt
             @@unique([flagKey, rooftopId])
```

**Key files created:**

- `.github/workflows/ci.yml` — `ci` job (typecheck/lint/build) + `schema-drift` job (PR-only)
- `lib/flags/evaluate.ts` — evaluator, setter, bulk loader
- `app/api/admin/flags/route.ts` — `GET/PATCH /api/admin/flags`
- `app/api/admin/rooftops/route.ts` — `GET /api/admin/rooftops` (org-scoped rooftop list for flag UI)
- `app/dashboard/admin/flags/page.tsx` — admin toggle UI with rooftop scope selector

**Key files modified:**

- `prisma/schema.prisma` — added `FeatureFlag` model
- `lib/auth.ts` — reads `mfa_enforcement` flag at sign-in + rooftop switch; stores in JWT as `mfaEnforcementEnabled`
- `middleware.ts` — gates MFA redirect on `token.mfaEnforcementEnabled`
- `app/api/ro/[id]/route.ts` — `triggerDMSSync` checks `dms_sync` flag before live push
- `components/layouts/dashboard-shell.tsx` — added "Feature Flags" nav entry (admin only)

---

## Key Conventions

### API Route Pattern
```ts
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  // ... prisma queries scoped to user.rooftopId
}
```

### JSON fields in Prisma
All JSON is stored as `String @db.Text`. Always `JSON.parse` / `JSON.stringify` manually:
```ts
const data = JSON.parse(record.conditions ?? "{}");
```

### Next.js 16 dynamic params
Params are a Promise in Next.js 16+:
```ts
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
// Client-side: use useSearchParams() hook, NOT searchParams prop
```

### shadcn/ui components available
`button`, `badge`, `card`, `input`, `label`, `select`, `dialog`, `sheet` — all in `components/ui/`

---

## File Tree (key paths)

```
parts-picker/
├── app/
│   ├── api/
│   │   ├── admin/          # CRUD for rules, users, rooftop settings
│   │   ├── analytics/      # GET /api/analytics
│   │   ├── auth/           # NextAuth [...nextauth]
│   │   ├── ingest/         # GET list + POST upload
│   │   ├── maintenance/    # GET schedule by VIN+mileage
│   │   ├── ro/             # RO CRUD, calculate, PDF
│   │   ├── rooftop/        # Rooftop settings
│   │   └── vin/            # VIN decode
│   ├── auth/               # Sign-in page
│   └── dashboard/
│       ├── admin/          # Admin panel pages
│       ├── analytics/      # Phase 7 — analytics
│       ├── ingest/         # Phase 6 — document ingest
│       ├── ro/             # RO wizard + list + detail
│       └── settings/       # Rooftop settings UI
├── components/
│   ├── admin/              # Rules CRUD client components
│   ├── layouts/            # dashboard-shell.tsx (sidebar nav)
│   └── ui/                 # shadcn components
├── lib/
│   ├── auth.ts             # NextAuth config
│   ├── db.ts               # Prisma singleton
│   ├── ingest/             # extract.ts (Claude Haiku)
│   ├── labor/              # lookup.ts
│   ├── maintenance/        # schedule.ts
│   ├── parts/              # recommend.ts
│   ├── pricing/            # calculate.ts
│   └── vin/                # decode.ts, normalize.ts
├── prisma/
│   └── schema.prisma
└── middleware.ts            # Route protection
```

---

## Features Built Beyond Phase 12

These are fully implemented and in the codebase but were not part of the original 12-phase spec. All schema models, API routes, and UI pages exist.

---

### Inventory Management ✅

**Pages:** `/dashboard/inventory`, `/dashboard/inventory/returns`
**Schema:** `PartInventory`, `InventoryMovement`

Per-rooftop parts stock management. Each part has a bin location, quantity on hand, reorder point, reorder quantity, supplier, unit cost, and sell price. Every stock change (receive, use, adjust, return) is recorded as an `InventoryMovement` for a full audit trail. The RO workflow automatically decrements stock when parts are marked used. The inventory page lets advisors/managers search by part number or description, add new items, edit quantities, and see movement history. Low-stock items (on hand ≤ reorder point) are flagged.

**Key files:**

- `app/dashboard/inventory/page.tsx` + `inventory-client.tsx`
- `app/dashboard/inventory/returns/page.tsx` — core/warranty returns pipeline
- `app/api/inventory/route.ts` — `GET/POST /api/inventory`
- `app/api/inventory/[id]/route.ts` — `GET/PATCH/DELETE`
- `lib/inventory/ro-integration.ts` — stock decrement hook called when RO closes

---

### Customer Approval Portal ✅

**Pages:** `/portal/[token]`
**Schema:** `ROApprovalToken`, `ROLineItemDecision`

When an advisor presents an RO, they can generate a shareable link for the customer. The customer opens the link (no login required) and sees the full estimate with every line item. They approve or decline each item individually, add their name, and submit. The advisor is notified when decisions come in. Decisions are recorded on `ROLineItemDecision` and reflected back in the RO. Tokens expire after 72 hours and are single-use.

**Key files:**

- `app/api/ro/[id]/approval-token/route.ts` — generate token
- `app/api/ro/[id]/present/route.ts` — mark RO as presented + trigger token
- `app/api/portal/[token]/route.ts` — public: fetch RO for customer
- `app/api/portal/[token]/decide/route.ts` — public: submit decisions
- `lib/approval/send-link.ts` — link generation helper

---

### Digital Vehicle Inspection (DVI) ✅

**Pages:** `/dashboard/ro/[id]/dvi`
**Schema:** `DVIReport`, `DVIItem`

Technician-facing inspection capture tool. When a tech opens a DVI for an RO, a report is auto-created with one item per line item on the RO. The tech sets each item's condition (`ok` / `advisory` / `critical`), adds notes, and uploads photos directly from their device. Photos are stored in Vercel Blob. The DVI is accessed from the RO detail page and shows a live status (`in_progress` / `complete`). Advisors can see the completed DVI when reviewing the RO.

**Key files:**

- `app/dashboard/ro/[id]/dvi/page.tsx`
- `app/api/ro/[id]/dvi/route.ts` — `GET/PATCH`
- `app/api/ro/[id]/dvi/items/[itemId]/route.ts` — update individual item
- `app/api/ro/[id]/dvi/items/[itemId]/upload/route.ts` — photo upload to Vercel Blob
- `components/dvi/dvi-capture.tsx` — capture UI
- `lib/dvi/create-report.ts` — auto-creates report from RO line items

---

### Tech Time Clock ✅

**Pages:** `/dashboard/tech/time-clock`
**Schema:** `TimeEntry`

Technicians clock in and out per RO (and optionally per labor op). Each `TimeEntry` records start time, end time, the associated RO, the specific line item (labor op), and the flat-rate hours from the OEM schedule. This lets the system calculate actual time vs. flat-rate sold — the core efficiency metric. Today's entries and a running clock are shown on the time clock page. Managers can view efficiency reports at `/dashboard/admin/reports/tech-efficiency`.

**Key files:**

- `app/dashboard/tech/time-clock/page.tsx`
- `app/api/ro/[id]/time-entries/route.ts` — `GET/POST`
- `app/api/reports/tech-efficiency/route.ts` — aggregated efficiency stats
- `app/dashboard/admin/reports/tech-efficiency/page.tsx`
- `lib/timeclock/efficiency.ts` — actual vs. flat-rate hour calculations

---

### Parts Ordering Integration ✅

**Pages:** RO detail → "Order Parts" panel
**Schema:** `PartsOrder`

From within an RO, advisors/parts staff can search for parts at NAPA and AutoZone and submit an order without leaving the app. The system searches by part number or description, returns availability and pricing, and records the order as a `PartsOrder` linked to the RO. Order status flows: `pending → submitted → confirmed | error`. A mock adapter exists for development. The factory pattern (`lib/parts-ordering/factory.ts`) makes it easy to add more suppliers.

**Key files:**

- `app/api/parts-ordering/search/route.ts` — search across suppliers
- `app/api/ro/[id]/parts-orders/route.ts` — `GET/POST`
- `app/api/ro/[id]/parts-orders/[orderId]/route.ts` — status update
- `lib/parts-ordering/adapter.ts` — `PartsOrderingAdapter` interface
- `lib/parts-ordering/napa.ts` — NAPA adapter
- `lib/parts-ordering/autozone.ts` — AutoZone adapter
- `lib/parts-ordering/mock.ts` — mock adapter for dev/testing

---

### Core & Warranty Return Tracking ✅

**Pages:** `/dashboard/inventory/returns`
**Schema:** `PartReturn`

Tracks parts returned to suppliers for credit — both core returns (rebuildable part swaps) and warranty returns (defective part claims). Each return record captures part number, supplier, return type, expected credit amount, tracking number, and moves through a status pipeline: `pending → submitted → received → credited | rejected`. When a return is credited, the actual credit amount is recorded. A pipeline summary at the top of the returns page shows counts and total pending credit value by status.

**Key files:**

- `app/dashboard/inventory/returns/page.tsx`
- `app/api/part-returns/route.ts` — `GET/POST`
- `app/api/part-returns/[id]/route.ts` — `PATCH` (status advancement)
- `app/api/ro/[id]/part-returns/route.ts` — create return from RO line item
- `components/returns/return-form.tsx`
- `components/returns/return-status-badge.tsx`

---

### Canned Inspections ✅

**Pages:** `/dashboard/ro/[id]/inspections`, `/dashboard/admin/inspections`
**Schema:** `InspectionTemplate`, `InspectionTemplateItem`, `RoInspection`, `InspectionResult`

Admins define reusable multi-point inspection templates (e.g. "30-Point Safety Check", "Pre-Delivery Inspection"). Each template has items with a check type: `condition` (ok/advisory/critical), `passfail` (pass/fail), or `measurement` (numeric with unit). Templates can optionally auto-attach to ROs when mileage falls within a configurable window of a trigger mileage. Techs complete inspections per RO, item by item. Results are stored per-inspection. Completed inspections are visible on the RO detail page.

**Key files:**

- `app/dashboard/ro/[id]/inspections/page.tsx`
- `app/dashboard/admin/inspections/page.tsx`
- `app/api/inspection-templates/route.ts` — `GET/POST`
- `app/api/inspection-templates/[id]/route.ts` — `GET/PATCH/DELETE`
- `app/api/ro/[id]/inspections/route.ts` — `GET/POST`
- `app/api/ro/[id]/inspections/[inspId]/route.ts` — update results
- `lib/inspections/auto-attach.ts` — mileage-triggered auto-attach logic

---

### Tech Dashboard ✅

**Pages:** `/dashboard/tech`
**Role:** `technician` only

A simplified, role-gated dashboard for technicians. Shows only the ROs assigned to them, their time clock status, and quick links to DVI and inspections. Techs do not see the full advisor/manager dashboard. Redirects automatically if a non-tech tries to access it.

---

### Tech Board ✅

**Pages:** `/dashboard/tech-board`
**Role:** advisor, manager, admin

A live operations view showing all technicians at the rooftop and their currently assigned ROs in card columns. Each tech card shows their active RO count, the vehicles they're working on, labor ops with flat-rate hours, parts needed, and the RO dollar value. Useful for dispatchers and service managers to see shop load at a glance and identify idle techs. Refreshes on demand.

**Key files:**

- `app/dashboard/tech-board/page.tsx`
- `app/api/tech-board/route.ts`

---

### Customer Lookup ✅

**Pages:** `/dashboard/customers`

Search customers by name, phone number, or VIN. Results show every vehicle associated with that customer (matched across ROs by contact info), lifetime spend, visit count, and last visit date. Expanding a customer card shows their full service history — every RO with status, date, services performed, and total. Each RO links directly to the RO detail page. This is a read-only lookup that aggregates across ROs rather than a separate `Customer` table.

**Key files:**

- `app/dashboard/customers/page.tsx`
- `app/api/customers/search/route.ts`

---

### RO Messaging ✅

**Schema:** `ROMessage`

Threaded internal communication per RO. Three message categories: `message` (internal advisor/tech chat), `note` (formal dealer-wide log entry), `external` (customer-facing communication record). Visible on the RO detail page. Used to keep a full communication trail for every job without relying on text messages or email that lives outside the system.

**Key files:**

- `app/api/ro/[id]/messages/route.ts` — `GET/POST`
- Schema: `ROMessage` with `authorId`, `category`, `content`

---

### Announcements ✅

**Pages:** `/dashboard/announcements`
**Schema:** `Announcement`

Admins and managers can post rooftop-wide announcements with three priority levels: `info`, `warning`, `urgent`. Announcements can have an expiry date, after which they're no longer shown. All staff at the rooftop see them. Used for shift notes, policy changes, supplier alerts, or time-sensitive operational notices.

**Key files:**

- `app/dashboard/announcements/page.tsx`
- `app/api/announcements/route.ts` — `GET/POST`
- `app/api/announcements/[id]/route.ts` — `PATCH/DELETE`

---

### Appointment Calendar ✅

**Pages:** `/dashboard/calendar`
**Schema:** `scheduledAt`, `estimatedDuration` on `RepairOrder`

A calendar view of all scheduled ROs for the rooftop. ROs with a `scheduledAt` date appear as events. Service advisors and managers can schedule appointments when creating or editing an RO, set an estimated duration, and assign a tech. The calendar respects the rooftop's configured timezone. Technicians are redirected away from the calendar to their tech dashboard.

**Key files:**

- `app/dashboard/calendar/page.tsx` + `calendar-client.tsx`
- `app/api/calendar/events/route.ts` — returns scheduled ROs as calendar events

---

### RO Numbering ✅

**Schema:** `roNumberPrefix`, `roNumberNext`, `roNumberPadding` on `Rooftop`; `roNumber` on `RepairOrder`

Human-readable RO numbers assigned sequentially at creation. Configurable prefix (e.g. `RO-`, `WO-`, or blank), zero-padding width (e.g. 5 digits → `00042`), and starting number. The `roNumber` field is unique and appears on the RO list, detail page, PDF, and anywhere an RO is referenced. Configured per rooftop in admin settings.

---

### Stock Check on RO ✅

**API:** `GET /api/ro/[id]/stock-check`

When an RO is in the review step of the wizard, the system checks current inventory for each part line item and returns availability status. Advisors see which parts are in stock vs. need to be ordered before committing to the customer. Integrates with the `PartInventory` table.

---

## Roadmap — Ideas to Build Next

These are not built. Ordered by estimated impact for the primary user (parts manager / service advisor at a dealership or independent shop).

---

### 1. NHTSA Safety Recall Integration

**Impact: High | Effort: Low**

The NHTSA provides a completely free recall API (`api.nhtsa.gov/recalls/recallsByVehicle`). Every time a VIN is decoded or an RO is opened, automatically check for open recall campaigns and display them. Show campaign number, affected component, remedy status, and a badge on the RO if open recalls exist. Add a "Recall Addressed" toggle so advisors can document that they informed the customer. This is a compliance and liability issue — advisors are supposed to check this on every vehicle intake, and currently they have to leave the app to do it.

---

### 2. Special Order Parts (SOP) Workflow

**Impact: High | Effort: Medium**

A dedicated lifecycle for parts ordered specifically for a customer. SOPs are currently tracked on whiteboards or spreadsheets in most shops. The workflow:

- Create an SOP record tied to a customer and optionally an RO
- Track deposit collected, vendor PO, supplier ETA
- Status pipeline: `ordered → received → customer_notified → picked_up`
- When the part arrives, notify the customer automatically and flag the waiting RO
- SOP report: all outstanding orders by age, flagging anything past ETA

---

### 3. Backorder Tracking & ETA Management

**Impact: High | Effort: Low-Medium**

The parts ordering integration submits orders but has no backorder awareness — it's fire and forget. Add a backorder flag to `PartsOrder` with an ETA date (manually entered or from supplier API). Surface a "Backorder Report" showing all open backorders sorted by age. When a part clears backorder, notify the advisor assigned to that RO. Add a "Source Elsewhere" action that opens a new parts search pre-filled with the same part number.

---

### 4. Global Search / Command Palette

**Impact: High | Effort: Low**

A `Ctrl+K` / `Cmd+K` command palette that searches across ROs (by number, VIN, customer name), inventory (by part number or description), and navigates to any page in the app. `shadcn/ui` ships `cmdk` which makes this straightforward to implement. Parts managers and advisors look things up constantly — having to navigate to the right section first adds up to a lot of friction across a full shift.

---

### 5. In-App Notification Center

**Impact: High | Effort: Medium**

A bell icon in the sidebar nav with an unread count. Add a `Notification` model (`userId`, `title`, `body`, `type`, `entityId`, `readAt`). Event types to generate notifications:

- `ro_approved` — customer approved the estimate
- `parts_arrived` — SOP or backorder cleared
- `dms_sync_failed` — DMS push failed, needs manual attention
- `inspection_flagged` — a DVI item marked critical
- `recall_found` — open recall on a vehicle being checked in
Notifications are role-targeted: techs get RO updates, parts manager gets order/inventory events, advisors get approval decisions.

---

### 6. Multi-Point Inspection PDF (Customer-Facing)

**Impact: High | Effort: Medium**

The canned inspection data and DVI photos already exist — there's no customer-facing output. Generate a branded PDF (or a shareable public URL) showing the completed inspection in traffic-light format (green/yellow/red per item) with tech notes and any photos from the DVI. This is one of the most proven upsell tools in service — customers approve more work when they see a photo of the worn brake pad or the cracked serpentine belt.

---

### 7. Lost Sales Tracking

**Impact: Medium-High | Effort: Low**

When a customer declines a line item through the approval portal or an advisor manually marks it rejected, capture a decline reason: `price`, `time_constraint`, `will_return`, `did_elsewhere`, `other`. Add a "Lost Sales" report that aggregates declined revenue by category, by advisor, and by reason over a date range. This is a KPI most shops don't track at all and is usually $50K–$200K/year in deferred revenue that management doesn't know is leaving.

---

### 8. Purchase Orders for Inventory Replenishment

**Impact: Medium-High | Effort: Medium**

A separate PO workflow for stocking orders, distinct from the RO-attached parts ordering. Add a `PurchaseOrder` model with `PurchaseOrderItem` lines, supplier, status (`draft → submitted → partial_received → received → invoiced`), and a receiving workflow. Auto-suggest POs by finding all `PartInventory` items where `quantityOnHand ≤ reorderPoint`, grouped by supplier. Receiving a PO auto-adjusts inventory quantities.

---

### 9. Parts Profitability & Fill Rate Analytics

**Impact: Medium-High | Effort: Medium**

A dedicated parts analytics section with KPIs that don't exist anywhere in the current analytics dashboard:

- **Fill rate**: % of part line items pulled from stock vs. ordered — industry target is >70%
- **Gross profit by category**: which categories (Filters, Brakes, Fluids, etc.) have the best margin
- **Inventory turns**: how many times per year each category turns over
- **Slow/dead stock**: parts with no movement in 90/180/365 days, with total value tied up
- **Core recovery rate**: % of cores successfully credited vs. charged but not recovered

---

### 10. Barcode & VIN Scanning

**Impact: Medium-High | Effort: Low**

Use `@zxing/browser` or `html5-qrcode` to scan barcodes and QR codes from the device camera. Three use cases:

- Scan the VIN barcode from the windshield sticker (door jamb label) into the VIN field on the RO wizard — eliminates the biggest source of typos
- Scan a part number barcode into the inventory search or parts order fields
- Scan a bin location barcode during inventory counts

This is a high-payoff tablet feature. The camera capture infrastructure from the DVI and document ingest work is already in place.

---

### 11. Warranty Claims Tracker

**Impact: Medium | Effort: Medium**

OEM warranty work is a meaningful revenue stream at dealerships with its own tracking needs. Add a warranty flag to ROs with fields: claim number, failure description, OEM labor code, parts used, submitted date, expected reimbursement amount. Status pipeline: `draft → submitted → approved → paid | rejected`. Track rejection reasons and resubmission outcomes. Add warranty revenue as a separate line in the analytics dashboard, isolated from customer-pay. Errors in warranty claim submission and tracking are a known source of revenue leakage.

---

### 12. SMS Customer Notifications

**Impact: Medium | Effort: Medium**

Twilio integration (or similar) for outbound SMS:

- "Your estimate is ready — approve here: [link]" when RO is presented (includes approval portal link)
- "Your vehicle is ready for pickup" when RO is closed
- "Your special order part has arrived" when SOP status → `received`
Opt-in stored on customer record. Message templates configurable per rooftop. Delivery log on the RO. Customers expect text updates — this is a table-stakes feature for modern shops.

---

### 13. Technician Pay Summary

**Impact: Medium | Effort: Low**

The time clock tracks flat-rate hours already. Close the loop to payroll by adding a weekly/bi-weekly tech pay summary:

- Flat-rate hours produced from closed ROs
- Actual hours clocked in (from `TimeEntry`)
- Efficiency ratio: flat-rate sold ÷ actual hours (100% = tech produced exactly as many hours as they worked)
- Breakdown by pay type: customer-pay, warranty, internal
- CSV export for payroll import

Most service managers do this manually in a spreadsheet each pay period.

---

### 14. Dark Mode

**Impact: Medium | Effort: Low-Medium**

Parts counters and shop floors are often dimly lit. Techs on tablets in the bay have bright screens in their faces. Tailwind + shadcn/ui support dark mode via the `class` strategy — adding it is a focused CSS theming pass. Include a toggle in user settings with an "auto" option that follows system preference.

---

### 15. Parts Request Queue (Bay → Counter)

**Impact: Medium | Effort: Low**

A lightweight request board for technicians to submit part needs from the bay without walking to the counter or radioing. Add a `PartsRequest` model: tech submits a request with RO number, part description/number, quantity, and urgency. The parts counter sees a live queue sorted by urgency and RO. Counter staff mark requests as `pulled` or `ordering`. Tech gets notified when their parts are on the way. Reduces radio traffic and the constant interruptions at the parts counter.

---

### 16. Loaner Vehicle Management

**Impact: Medium | Effort: Medium**

Many service departments have a fleet of customer loaner cars with no tracking system. Add a `LoanerVehicle` model (VIN, make/model/year, license plate, status: `available | loaned | in_service`). A `LoanerLoan` record ties a loaner to a customer RO with check-out and expected return date, fuel level, and mileage in/out. Photo capture at check-out and check-in for damage documentation (using existing DVI-style photo upload). Overdue alerts when a loaner isn't returned on time.

---

### 17. Technician Certification Tracker

**Impact: Medium | Effort: Low**

Add certification records per tech: ASE certification type (A1–A9, L1, etc.), OEM training, expiry date. Alert managers when a cert is within 90 days of expiry. Optionally enforce that certain labor operations can only be assigned to techs with the relevant certification — important for OEM warranty work, which often requires documented technician qualifications.

---

### 18. Fleet Account Management

**Impact: Medium | Effort: Medium**

Fleet customers (delivery companies, municipalities, rental agencies) have multiple vehicles and need centralized billing. A `FleetAccount` model with:

- Multiple vehicles tied to one account
- Custom pricing matrix override (different markup tiers from retail)
- Billing cycle: weekly or monthly batch invoice of all closed ROs
- Required PO number per RO (some fleet accounts require this before work starts)
- Fleet dashboard: all vehicles, open ROs, outstanding balance

---

### 19. Service Interval Reminders (Outbound)

**Impact: Medium | Effort: Medium**

The system knows the last service mileage and what was done per VIN. With an assumed annual mileage (configurable or estimated from RO history), calculate when the next service interval is due and send an email or SMS reminder in advance. Configurable per rooftop: which services trigger reminders, how far in advance, opt-in/opt-out management. This is a passive revenue generation tool — shops typically see a 15–25% response rate on well-timed service reminders.

---

### 20. Internal / Reconditioning RO Type

**Impact: Low-Medium | Effort: Low**

When the shop works on its own vehicles (loaner fleet maintenance, used car reconditioning, shop trucks), those ROs should not be priced at retail and should not inflate customer-pay revenue in analytics. Add a billing mode field on ROs: `retail`, `internal`, `warranty`. Internal ROs use cost-only pricing (no markup). Analytics reports break out revenue by billing type. Used car reconditioning is a significant operation at dealerships and is currently invisible in the system.
