# Changelog

Übersicht über alle Änderungen und Features.

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

- **ZUGFeRD PDF fixture** – Integration test “should parse ZUGFeRD 2.3 PDF with embedded CII XML when fixture is present” runs when `tests/fixtures/zugferd-invoice.pdf` exists; otherwise skipped with a short note. `tests/fixtures/README.md` describes how to obtain a sample PDF (e.g. ZUGFeRD/corpus).

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
    status: 'CREATED'
  },
  data: { status: 'READY' }
})
```

**Actor Tracking für neue Exports:**
```typescript
import { createExport } from '@/src/lib/exports/processor'

// WICHTIG: userId mitgeben für Audit Trail
const exp = await createExport(
  {
    organizationId: 'org_123',
    format: 'CSV',
    filename: 'export.csv',
    invoiceIds: ['inv_1', 'inv_2'],
  },
  session.user.id  // Actor tracking
)
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
