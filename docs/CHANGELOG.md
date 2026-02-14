# Changelog

Übersicht über alle Änderungen und Features.

## 2026-02-14: ZUGFeRD PDF Generator (PDF/A-3)

### Changes

#### New: ZUGFeRD PDF generator

- Added `src/lib/generators/zugferdGenerator.ts` to generate the visual PDF
  from validated invoice form data (`reviewData`) and combine it with an
  existing XRechnung XML payload into one hybrid ZUGFeRD-style PDF.
- XML attachment is embedded as either `factur-x.xml` (default) or
  `zugferd-invoice.xml`, using `AFRelationship=Alternative`.
- Generator sets PDF/A-3 relevant metadata/XMP entries, including
  `pdfaid:part=3`, `pdfaid:conformance=B`, `fx:Version`, and
  `fx:ConformanceLevel`.
- Updated default ZUGFeRD metadata version from `2.3` to `2.4`.
- Output filename now follows `[invoiceNumber]-zugferd.pdf` by default
  (override via explicit `outputBaseFilename`).
- Updated `src/lib/zugferd/zugferd-parser.ts` XML extraction with
  decompression fallback (`inflate` / `inflateRaw`) so attached XML can be
  read from both compressed and uncompressed embedded-file streams.

#### New: Root shim export

- Added `lib/generators/zugferdGenerator.ts` as root-level re-export to match
  existing generator import patterns.

#### Tests

- Added `tests/zugferd/zugferdGenerator.test.ts` covering:
  - workflow input `validatedInvoice + xrechnungXml` (without source upload PDF)
  - XML embedding and extraction from the generated PDF
  - PDF metadata markers for PDF/A-3 + ZUGFeRD profile fields
  - output filename convention

## 2026-02-14: XRechnung CII Generator + XSD Validation

### Changes

#### New: XRechnung generator

- Added `src/lib/generators/xrechnungGenerator.ts` to generate human-readable
  XRechnung XML (CII flavor) from DB invoice data.
- Added shim export at `lib/generators/xrechnungGenerator.ts` for direct
  project-root path usage.
- Generator maps `Invoice` + `InvoiceLineItem[]` + optional
  `rawJson.extendedData` into `@e-invoice-eu/core` input format and enforces
  required invoice fields.

#### New: Offline XSD validation for generated XML

- Added offline CII/EN16931 XSD bundle under
  `src/lib/generators/schemas/xrechnung/`.
- Added validation pipeline using `xmllint --schema` with structured error
  reporting.
- Added explicit profile check for XRechnung 3.0 guideline id
  (`xrechnung_3.0`) before returning generated XML.
- Extended profile validation to accept `xrechnung_3.0.x` patch versions.
- Default XSD resolution now auto-selects the highest bundled
  `Factur-X_*_EN16931.xsd` version, instead of one hard-coded filename.

## 2026-02-14: Supabase RLS alignment with current schema

### Changes

#### Updated: RLS SQL scripts

- Updated RLS policies from legacy `Upload` table to current `File` table in:
  - `prisma/migrations/setup_rls_policies.sql`
  - `prisma/migrations/fix_rls_recursion.sql`

#### Updated: RLS setup automation

- `scripts/setup-rls.ts` now applies both:
  - base RLS policies
  - recursion-fix helpers/policies

#### Documentation

- Updated `docs/runbooks/supabase-rls.md` to reflect current `OrganizationMember`-based model and execution flow.
- Updated `docs/SETUP.md` and `scripts/supabase/README.md` for the new one-step RLS setup.

## 2026-02-14: Invoice API `statusGroup` Mapping

### Changes

#### Updated: Invoice API responses

- Added `statusGroup` to invoice response payloads for:
  - `GET /api/invoices`
  - `GET /api/invoices/[invoiceId]`
  - `PUT /api/invoices/[invoiceId]`
  - `POST /api/invoices/upload`
  - `POST /api/process-invoice/[fileId]`
  - `POST /api/invoices/import/zugferd?save=true` (`persistence.statusGroup`)
- Extended `GET /api/invoices?statusGroup=` filter to: `uploaded`, `processing`, `processed`, `failed`, `exported`.

#### New: Shared status-group mapper

- Added `mapInvoiceStatusToApiStatusGroup()` in `src/lib/invoices/status.ts`.
- API grouping is now standardized as:
  - `uploaded`, `processing`, `processed`, `failed`, `exported`

#### Tests

- Extended invoice API route tests to assert `statusGroup` in response payloads.

## 2026-02-14: ZUGFeRD Import mit optionaler Persistierung

### Changes

#### Updated: `POST /api/invoices/import/zugferd`

- Neuer Query-Parameter `save=true|false|1|0` für optionales Speichern der geparsten Rechnungen.
- Parse-only bleibt Standard, wenn `save` nicht gesetzt ist.
- Bei `save=true` werden erfolgreiche Parse-Ergebnisse in `Invoice` persistiert.
- Re-Processing ist integriert: gleiche `organizationId` + `number` führt zu Update statt Duplikat-Erstellung.
- Batch-Import mit `save=true` unterstützt Partial-Failures (`207 Multi-Status`), wenn einzelne Persistierungen fehlschlagen.

#### New: Invoice Import Persistence Service

- Neue Service-Logik in `src/server/services/invoice-import.ts`.
- Setzt Status bei Persistierung auf `VALIDATED` (oder behält `EXPORTED` bei Updates).
- Aktualisiert/ersetzt Line Items beim Re-Processing.
- Speichert Parse-/Validierungsmetadaten in `Invoice.rawJson`.

#### Documentation

- `docs/api/README.md` — `save`-Parameter, Persistierungsverhalten und Response-Erweiterung dokumentiert.

---

## 2026-02-12: Mock OCR Service

### Changes

#### New: `MockOcrService` (`src/server/services/ocr/mock-service.ts`)

- Drop-in replacement for `OcrService` that loads pre-defined JSON fixtures instead of calling Google Cloud Vision API
- Enable via `OCR_MOCK_ENABLED=true` environment variable
- Loads fixtures from `mocks/ocr-responses/` directory (3 German invoice samples included)
- Cycles through fixtures on successive calls for varied test data

#### New: `IOcrService` interface (`src/server/services/ocr/types.ts`)

- Shared interface implemented by both `OcrService` and `MockOcrService`
- Defines `processFile()` and `parseInvoice()` contract
- `getOcrService()` now returns `IOcrService` — transparent switching between real and mock

#### New: Mock response fixtures (`mocks/ocr-responses/`)

- `invoice-standard.json` — Standard single-page German invoice (Musterfirma GmbH, 3 line items)
- `invoice-multi-page.json` — Multi-page IT services invoice (TechSolutions AG, 6 line items)
- `invoice-minimal.json` — Minimal Kleinunternehmer invoice (1 line item, no tax)

#### Updated: `.env.example`

- Added `OCR_MOCK_ENABLED` variable documentation

## 2026-02-12: Standardized API Auth & Error Handling

### Changes

#### New: `ApiError` class (`src/lib/errors/api-error.ts`)

- Standardized error class with typed error codes: `UNAUTHENTICATED`, `NO_ORGANIZATION`, `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`
- Each code maps to an HTTP status code
- `toResponse()` method returns `NextResponse` with structured JSON: `{ success: false, error: { code, message, details? } }`
- Static factory methods: `ApiError.unauthenticated()`, `ApiError.noOrganization()`, `ApiError.validationError()`, etc.

#### New: `getMyUserOrThrow()` and `getMyOrganizationIdOrThrow()` (`src/lib/auth/session.ts`)

- **`getMyUserOrThrow()`** — Replaces `requireApiAuth()`. Throws `ApiError` instead of returning `NextResponse`. Used for user-level API routes (Stripe checkout/portal).
- **`getMyOrganizationIdOrThrow()`** — Replaces `requireApiAuthWithOrg()`. Throws `ApiError` instead of returning `NextResponse`. Respects `active-org-id` cookie (consistent with app layout), falls back to first membership.
- Old helpers `requireApiAuth()` and `requireApiAuthWithOrg()` removed.

#### Migrated all API routes

All API routes now use the `try/catch` + `ApiError` pattern with consistent structured JSON errors:

- `/api/exports` (GET, POST) — Was: manual `getCurrentUser()` + `findFirst`. Now: `getMyOrganizationIdOrThrow()`
- `/api/exports/[exportId]/download` (GET) — Same migration
- `/api/invoices/export/datev` (GET, POST) — Was: `requireApiAuthWithOrg()` + `instanceof NextResponse`. Now: `getMyOrganizationIdOrThrow()`
- `/api/invoices/import/zugferd` (POST) — Same migration
- `/api/invoices/validate/gobd` (POST) — Was: `requireApiAuth()`. Now: `getMyOrganizationIdOrThrow()`
- `/api/ocr` (POST) — Was: `requireApiAuth()` (no org). Now: `getMyOrganizationIdOrThrow()` (org-scoped)
- `/api/stripe/checkout` (POST) — Was: manual Supabase auth. Now: `getMyUserOrThrow()`
- `/api/stripe/portal` (POST) — Same migration
- `/api/invoices`, `/api/invoices/[invoiceId]`, `/api/uploads`, `/api/uploads/[uploadId]` — Placeholder routes now use `getMyOrganizationIdOrThrow()`
- All `console.error` calls replaced with `logger.error` (Pino)

#### Tests

- New: `tests/auth/session.test.ts` — 11 tests covering `getMyUserOrThrow()`, `getMyOrganizationIdOrThrow()`, and `ApiError.toResponse()`
- Updated: `tests/ocr/route.test.ts` — Mock updated from `requireApiAuth` to `getMyOrganizationIdOrThrow`

### Documentation

- `docs/architecture.md` — Auth helpers section updated
- `docs/api/README.md` — Error format and error codes documented
- `docs/CHANGELOG.md` — This entry

---

## 2026-02-12: Middleware Auth Guard & API Route Protection

### Changes

#### Middleware (`middleware.ts`)

- **Token refresh for API routes** — Expanded middleware matcher to include `/api/*` routes. Previously only page routes got JWT refresh; now API calls also trigger automatic token refresh, preventing silent auth failures when access tokens expire between page loads.
- **Route protection** — Middleware now redirects unauthenticated users to `/login` for protected paths (`/dashboard`, `/invoices`, `/exports`, `/settings`). Passes `redirectTo` query param for post-login redirect.
- **Updated to `getUser()`** — Replaced `getClaims()` with `getUser()` per Supabase SSR best practices. This verifies the JWT server-side and triggers refresh if expired.
- **Cookie handling** — Updated to `getAll/setAll` pattern matching the server client.

#### Shared Auth Helpers (`src/lib/auth/session.ts`)

- **`requireApiAuth()`** — New helper for API route handlers. Returns the authenticated Prisma `User` or a `401 Unauthorized` JSON response. Replaces duplicated auth checks across routes.
- **`requireApiAuthWithOrg()`** — Same as above but also resolves the user's `organizationId` via `OrganizationMember`. Returns `403` if user has no org membership. Used for routes that need org-scoped data access.

#### API Route Auth Guards

- **`/api/ocr` (POST)** — Now requires JWT auth. Removed trust of `x-user-id` header; rate limiting now uses the authenticated `user.id` instead.
- **`/api/invoices/import/zugferd` (POST)** — Now requires auth + org membership.
- **`/api/invoices/validate/gobd` (POST)** — Now requires auth.
- **`/api/invoices/export/datev` (POST, GET)** — Now requires auth + org membership. DB queries scoped to user's organization (prevents cross-org data access).
- **`/api/invoices/[invoiceId]` (GET, PUT, DELETE)** — Placeholder routes now have auth scaffolding.
- **`/api/uploads/[uploadId]` (GET, DELETE)** — Placeholder routes now have auth scaffolding.

#### Routes intentionally left public

- `/api/health` — Health check
- `/api/waitlist/join` — Public waitlist signup
- `/api/stripe/webhook` — Stripe signature verification
- `/auth/callback` — OAuth/email confirmation handler

### Documentation

- **`docs/architecture.md`** — Authentication section expanded with middleware behavior, session helpers, client types, and protected route documentation.

---

## 2025-02-10: ZUGFeRD Parser Gaps & Consolidation

### Changes

#### Validation

- **Structural/required-fields validation** – `src/lib/zugferd/validator.ts` now performs well-formedness checks and EN 16931 required-field validation (CII and UBL). Full XSD schema validation is not implemented; behavior is documented and `schemaCache`/`preloadSchema` remain for future use.

#### API

- **Batch import** – `POST /api/invoices/import/zugferd` supports batch requests: multiple files via `multipart/form-data` (field `file`) or JSON body `{ invoices: [{ xml, format? }] }`. Max 50 files/items per request; concurrency-limited batch parsing (5 at a time).
- **API docs** – `docs/api/README.md` documents `GET` and `POST /api/invoices/import/zugferd` (single and batch, request/response examples). Endpoint is documented as parse-only (no persistence); optional persistence may be added later.

#### Parser consolidation

- **Single parser stack** – Removed duplicate ZUGFeRD/XRechnung implementation from `src/server/parsers/` (zugferd, xrechnung, cii, ubl, mapper, xml-utils, types, errors, schemas). All parsing now uses `src/lib/zugferd/`. OCR remains in `src/server/parsers/ocr/`.
- **Tests** – Integration and unit tests migrated to `src/lib/zugferd/`. New `tests/unit/parsers/format-detection.test.ts` for format detection and validation. Removed `tests/unit/parsers/xml-utils.test.ts`.

#### Integration test

- **ZUGFeRD PDF fixture** – Integration test “should parse ZUGFeRD PDF with embedded CII XML when fixture is present” runs when `tests/fixtures/zugferd-invoice.pdf` exists; otherwise skipped with a short note. `tests/fixtures/README.md` describes how to obtain a sample PDF (e.g. ZUGFeRD/corpus).

#### Documentation

- **`docs/architecture.md`** – Parsers section updated to reference `src/lib/zugferd/` for ZUGFeRD/XRechnung.

## 2025-01-29: Static Assets & Branding

### ✨ Neue Features

#### Static Assets

- **`public/assets/`** – Ordner für App-Bilder (Logos, Illustrationen, Favicon)
- Bilder aus Cursor-Assets nach `public/assets/` übernommen und sinnvoll benannt:
  - `logo-icon.png` – E-Rechnung Icon („e“ in abgerundetem Quadrat)
  - `logo-full.png` – Smart e-Rechnung Logo (Icon + Text)
  - `favicon.png` – Favicon
  - `login-illustration.png` – Illustration für Auth-Seiten
  - `hero-illustration.png` – Hero „Digitale Rechnungen. Einfach. Schnell. Effizient.“

#### Nutzung in der App

- **Auth-Layout** – Logo-Icon statt FileText, Login-Illustration statt SVG
- **App-Nav** – Logo-Icon neben „E-Rechnung“
- **Marketing-Page** – Hero mit `hero-illustration`, `logo-full`, Claim „Digitale Rechnungen. Einfach. Schnell. Effizient.“
- **Favicon** – `app/icon.png` aus Favicon-Asset, Next.js bindet es automatisch ein

### 📚 Dokumentation

- **`docs/architecture.md`** – Abschnitt „Static Assets“ ergänzt (`public/`, `public/assets/`, Nutzung via `/assets/...`)

## 2024-01-27: Export Status Tracking & Audit Trail

### ✨ Neue Features

#### 1. Export Status Tracking

Exports durchlaufen jetzt explizite Status-Zustände für bessere Fehlerbehandlung und Monitoring:

**ExportStatus Enum:**

- `CREATED` - Export erstellt, Generierung steht aus
- `GENERATING` - Export wird gerade generiert
- `READY` - Export erfolgreich erstellt, bereit zum Download
- `FAILED` - Generierung fehlgeschlagen

**Neue Felder in Export Tabelle:**

- `status: ExportStatus` - Aktueller Status (Default: CREATED)
- `errorMessage: string?` - Fehlermeldung bei FAILED Status

**Neue Funktionen:**

- Status-Validierung mit erlaubten Transitionen
- Stuck Export Detection (automatisches Failover nach Timeout)
- Export Statistiken und Monitoring
- UI Helpers für Status-Anzeige

**Dateien:**

- `src/lib/exports/status.ts` - Status Utilities
- `src/lib/exports/processor.ts` - Export Lifecycle Management
- `docs/export-processing.md` - Vollständige Dokumentation

#### 2. Audit Trail & Actor Tracking

Nachverfolgbarkeit von Aktionen durch User-Tracking:

**Neue Felder:**

- `Invoice.createdBy: string?` - FK zu User (wer hat Rechnung hochgeladen?)
- `Export.createdBy: string?` - FK zu User (wer hat Export erstellt?)

**Neue Relations:**

- `User.createdInvoices` - Alle Invoices, die der User erstellt hat
- `User.createdExports` - Alle Exports, die der User erstellt hat

**Use Cases:**

- Compliance & DSGVO-Anforderungen
- Activity Feeds & User-Dashboards
- Top Contributors Statistiken
- Impact Analysis vor User-Löschung

**Dateien:**

- `docs/audit-trail.md` - Vollständige Dokumentation

### 🗄️ Database Migration

**Migration:** `20260127221201_add_export_status_and_audit_trail`

```sql
-- Export Status Enum
CREATE TYPE "ExportStatus" AS ENUM ('CREATED', 'GENERATING', 'READY', 'FAILED');

-- Export: Status & Error Message
ALTER TABLE "Export"
  ADD COLUMN "status" "ExportStatus" NOT NULL DEFAULT 'CREATED',
  ADD COLUMN "errorMessage" TEXT;

-- Audit Trail: createdBy Felder
ALTER TABLE "Export" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "createdBy" TEXT;

-- Indizes für Performance
CREATE INDEX "Export_status_idx" ON "Export"("status");
CREATE INDEX "Export_createdBy_idx" ON "Export"("createdBy");
CREATE INDEX "Invoice_createdBy_idx" ON "Invoice"("createdBy");

-- Foreign Keys
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "Export" ADD CONSTRAINT "Export_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL;
```

### 📖 Dokumentation

**Neue Dokumentation:**

- `docs/export-processing.md` - Export Status Tracking Guide
- `docs/audit-trail.md` - Actor Tracking & DSGVO Guide

**Aktualisiert:**

- `docs/SETUP.md` - Links zu neuer Dokumentation

### 🔧 Breaking Changes

Keine Breaking Changes. Alle neuen Felder sind optional (nullable).

**Bestehende Exports:**

- Haben automatisch `status = 'CREATED'`
- `createdBy` ist `null` (Legacy-Daten)

### 📝 Migration Notes

**Legacy Exports ohne Status:**

```typescript
// Exports mit storageKey aber ohne Status auf READY setzen
await prisma.export.updateMany({
  where: {
    storageKey: { not: null },
    status: 'CREATED',
  },
  data: { status: 'READY' },
});
```

**Actor Tracking für neue Exports:**

```typescript
import { createExport } from '@/src/lib/exports/processor';

// WICHTIG: userId mitgeben für Audit Trail
const exp = await createExport(
  {
    organizationId: 'org_123',
    format: 'CSV',
    filename: 'export.csv',
    invoiceIds: ['inv_1', 'inv_2'],
  },
  session.user.id // Actor tracking
);
```

---

## 2024-01-27: Invoice Line Items

### ✨ Neue Features

Strukturierte Speicherung von einzelnen Rechnungspositionen:

**InvoiceLineItem Tabelle:**

- `positionIndex` - Reihenfolge der Position (1, 2, 3, ...)
- `description` - Positionsbeschreibung
- `quantity` - Menge (DECIMAL 18,4)
- `unitPrice` - Einzelpreis netto (DECIMAL 18,4)
- `taxRate` - Steuersatz % (DECIMAL 5,2)
- `netAmount`, `taxAmount`, `grossAmount` - Berechnete Beträge

**Funktionen:**

- `createLineItems()` - Batch-Erstellung mit Validierung
- `calculateLineItem()` - Automatische Berechnung der Beträge
- `validateLineItem()` - Validierung mit Rundungstoleranz (0.01€)
- `validateInvoiceTotals()` - Prüfung Invoice vs. Line Items
- `getLineItemStats()` - Statistiken und Aggregation

**Dateien:**

- `src/lib/invoices/line-items.ts` - Line Items Utilities
- `docs/invoice-line-items.md` - Vollständige Dokumentation

### 🗄️ Database Migration

**Migration:** `20260127220443_add_invoice_line_items`

---

## 2024-01-27: Invoice Revisions & Versioning

### ✨ Neue Features

Versionierung von Invoice-Daten für Re-Processing:

**InvoiceRevision Tabelle:**

- Speichert vollständige Snapshots von `rawJson`
- Processor-Version Tracking (Semantic Versioning)
- Zeitstempel für jede Revision

**Funktionen:**

- `createRevision()` - Neue Revision erstellen
- `reprocessInvoice()` - Invoice mit aktueller Parser-Version neu verarbeiten
- `getInvoicesNeedingReprocessing()` - Invoices mit alter Version finden
- `pruneOldRevisions()` - Retention Policy (N neueste behalten)

**Dateien:**

- `src/lib/invoices/revisions.ts` - Revision Management
- `docs/invoice-revisions.md` - Vollständige Dokumentation

### 🗄️ Database Migration

**Migration:** `20260127215941_add_invoice_revisions`

---

## 2024-01-27: Invoice Status Tracking

### ✨ Neue Features

Explizites Status-Tracking für Invoice Processing Pipeline:

**InvoiceStatus Enum:**

- `CREATED` - Invoice erstellt, noch nicht verarbeitet
- `PARSED` - Rohdaten erfolgreich extrahiert
- `VALIDATED` - Fachlich validiert (Summen, Pflichtfelder)
- `EXPORTED` - Mindestens ein Export erfolgreich erstellt
- `FAILED` - Verarbeitung fehlgeschlagen

**Neue Felder:**

- `status: InvoiceStatus` - Aktueller Status
- `lastProcessedAt: DateTime?` - Zeitpunkt der letzten Verarbeitung
- `processingVersion: Int` - Version Counter für Re-Processing

**Funktionen:**

- Status-Validierung mit erlaubten Transitionen
- Helper Functions für Status-Updates
- UI Helpers für Badge-Anzeige
- Processing Statistiken

**Dateien:**

- `src/lib/invoices/status.ts` - Status Utilities
- `src/lib/invoices/processor.ts` - Status Management
- `docs/invoice-processing.md` - Vollständige Dokumentation

### 🗄️ Database Migration

**Migration:** `20260127215627_add_invoice_status_tracking`

---

## 2024-01-27: Supabase Integration & Multi-Org Support

### ✨ Erste Version

Vollständige Supabase-Integration mit Multi-Tenant-Architektur:

**Features:**

- Email/Password Authentication mit Email-Bestätigung
- Multi-Organization Support (N:M via OrganizationMember)
- RLS Policies auf allen Tabellen
- Storage Buckets (documents, exports)
- Server Actions für Auth & Org Management
- Organization Switcher UI

**Dateien:**

- Complete auth flow in `/app/(auth)/`
- Protected dashboard in `/app/(dashboard)/`
- Server actions in `/app/actions/`
- RLS policies in `prisma/migrations/setup_rls_policies.sql`
- Complete setup guide in `docs/SETUP.md`

### 🗄️ Database Migration

**Migration:** `20260127133157_add_multi_org_support`

---

## Übersicht der Features

### Database Schema

```
User (Supabase Auth)
  ↓ N:M
OrganizationMember (mit Roles: OWNER, ADMIN, MEMBER)
  ↓
Organization
  ├── Uploads → Invoice (mit Status & Revisions)
  │             └── InvoiceLineItem (strukturierte Positionen)
  └── Exports (mit Status & Actor Tracking)
```

### Processing Pipeline

```
Upload → Invoice [CREATED] → Parse → [PARSED] → Validate → [VALIDATED] → Export → [EXPORTED]
                     ↓              ↓             ↓                          ↓
                  [FAILED]      [FAILED]       [FAILED]                 [FAILED]
                     ↓              ↓             ↓                          ↓
                  Retry          Retry         Retry                     Retry
```

### Status-Tracking

**Invoice:**

- CREATED → PARSED → VALIDATED → EXPORTED
- Re-Processing mit Versionierung
- Revision History

**Export:**

- CREATED → GENERATING → READY
- Stuck Detection & Auto-Failover
- Error Message Storage

**Upload:**

- PENDING → PROCESSED / FAILED

### Audit Trail

**Actor Tracking:**

- `Invoice.createdBy` - Wer hat Rechnung hochgeladen?
- `Export.createdBy` - Wer hat Export erstellt?

**Use Cases:**

- Compliance & DSGVO
- Activity Feeds
- Top Contributors
- Impact Analysis

### Monitoring & Queries

Alle Features haben:

- ✅ SQL Monitoring Queries
- ✅ Statistics Functions
- ✅ UI Helper Functions
- ✅ Comprehensive Documentation

### Dokumentation

**Setup & Configuration:**

- `docs/SETUP.md` - Vollständiger Setup Guide

**Invoice System:**

- `docs/invoice-processing.md` - Status & Workflow
- `docs/invoice-revisions.md` - Versionierung
- `docs/invoice-line-items.md` - Strukturierte Positionen

**Export System:**

- `docs/export-processing.md` - Status & Fehlerbehandlung

**Security & Compliance:**

- `docs/audit-trail.md` - Actor Tracking & DSGVO
- `docs/runbooks/supabase-rls.md` - RLS Policies

---

## Nächste Schritte

### Empfohlene Erweiterungen

1. **Background Job Queue**
   - Bull/BullMQ für Export Processing
   - Automatic Retry mit Exponential Backoff
   - Parallel Processing mit Concurrency Limit

2. **Webhook Notifications**
   - Export bereit zum Download
   - Invoice Verarbeitung fehlgeschlagen
   - Stuck Export Alerts

3. **Advanced Monitoring**
   - Prometheus Metrics
   - Grafana Dashboards
   - Sentry Error Tracking

4. **Enhanced Audit Log**
   - Separate AuditLog Tabelle
   - Alle Änderungen tracken (nicht nur Creation)
   - Diff-Visualisierung

5. **Rate Limiting**
   - Export Limits pro User/Org
   - Throttling für API Endpoints

6. **File Size Limits**
   - Upload Size Validation
   - Storage Quota Management
   - Automatic Cleanup alter Files
