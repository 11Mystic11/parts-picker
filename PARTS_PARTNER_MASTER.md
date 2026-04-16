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
