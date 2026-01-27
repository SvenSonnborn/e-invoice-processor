# Invoice Revisions & Re-Processing

Dokumentation zum Revision-System für Invoice-Verarbeitung.

## Übersicht

Das Revision-System ermöglicht:
- **Re-Processing:** Invoices können mit aktualisiertem Parser erneut verarbeitet werden
- **Audit-Trail:** Jede Verarbeitung wird als Revision gespeichert
- **Versionierung:** Processor-Version wird getrackt
- **Rollback:** Zu älteren Versionen zurückkehren (Debug)

## Datenmodell

### InvoiceRevision

```typescript
{
  id: string                // Unique ID
  invoiceId: string         // FK to Invoice
  rawJson: JSON             // Extrahierte Rohdaten
  processorVersion: string  // z.B. "1.0.0"
  createdAt: DateTime       // Wann verarbeitet
}
```

### Beziehung zu Invoice

```
Invoice 1 ─── N InvoiceRevision
    │
    └─ rawJson (zeigt auf aktuellste Revision)
```

**Regeln:**
1. Jede Verarbeitung erstellt neue Revision
2. `Invoice.rawJson` enthält immer die aktuellste Version
3. Alte Revisionen bleiben erhalten (Audit)
4. Bei Re-Processing: neue Revision + Update von `Invoice.rawJson`

## Processing Flow mit Revisionen

### 1. Initial Processing

```typescript
import { markAsParsed } from '@/src/lib/invoices/processor'

// Upload → Parse → Create Revision
const rawData = await parseInvoiceFile(upload.storageKey)

await markAsParsed(invoice.id, rawData, '1.0.0')

// Erstellt:
// - InvoiceRevision { rawJson: rawData, processorVersion: '1.0.0' }
// - Invoice.rawJson = rawData
// - Invoice.status = 'PARSED'
```

### 2. Re-Processing (neue Parser-Version)

```typescript
import { reprocessInvoice, CURRENT_PROCESSOR_VERSION } from '@/src/lib/invoices/revisions'

// Parser wurde von 1.0.0 auf 1.1.0 aktualisiert
// CURRENT_PROCESSOR_VERSION = '1.1.0'

const newRawData = await parseInvoiceFile(upload.storageKey)

await reprocessInvoice(invoice.id, newRawData)

// Erstellt:
// - Neue InvoiceRevision { rawJson: newRawData, processorVersion: '1.1.0' }
// - Invoice.rawJson = newRawData (überschrieben)
// - Invoice.processingVersion++
```

**Alte Revision bleibt erhalten:**
```sql
SELECT * FROM "InvoiceRevision" WHERE "invoiceId" = 'inv_123'
ORDER BY "createdAt" DESC;

-- Ergebnis:
-- id: rev_002, processorVersion: '1.1.0', createdAt: 2024-01-27 15:00 (neueste)
-- id: rev_001, processorVersion: '1.0.0', createdAt: 2024-01-27 10:00
```

## Processor-Versionierung

### Versionsschema

Semantic Versioning: `MAJOR.MINOR.PATCH`

- **MAJOR:** Breaking Changes (z.B. neues Format)
- **MINOR:** Neue Features (z.B. zusätzliche Felder)
- **PATCH:** Bug-Fixes (z.B. besseres Parsing)

**Beispiele:**
```typescript
'1.0.0'  // Initial release
'1.0.1'  // Bug-Fix: Datumsparsing korrigiert
'1.1.0'  // Feature: Neue Felder extrahiert
'2.0.0'  // Breaking: Komplett neues Parsing-System
```

### Aktuelle Version setzen

**Datei:** [src/lib/invoices/revisions.ts](../src/lib/invoices/revisions.ts)

```typescript
export const CURRENT_PROCESSOR_VERSION = '1.1.0'
```

**Wann aktualisieren:**
- ✅ Parser-Logik geändert
- ✅ Neue Felder extrahiert
- ✅ Bug-Fixes in Parsing
- ❌ Nicht bei UI-Änderungen
- ❌ Nicht bei Status-Changes

## Helper-Funktionen

### Revision erstellen

```typescript
import { createRevision } from '@/src/lib/invoices/revisions'

const revision = await createRevision({
  invoiceId: 'inv_123',
  rawJson: { /* parsed data */ },
  processorVersion: '1.0.0'  // optional, default: CURRENT_PROCESSOR_VERSION
})

// Erstellt Revision UND updated Invoice.rawJson
```

### Revisionen abrufen

```typescript
import { getRevisions, getLatestRevision } from '@/src/lib/invoices/revisions'

// Alle Revisionen (neueste zuerst)
const revisions = await getRevisions('inv_123')

revisions.forEach(rev => {
  console.log(rev.processorVersion, rev.isLatest, rev.revisionNumber)
})
// Output:
// '1.1.0', true,  2  (neueste)
// '1.0.0', false, 1

// Nur neueste
const latest = await getLatestRevision('inv_123')
```

### Revision-Statistiken

```typescript
import { getRevisionStats } from '@/src/lib/invoices/revisions'

const stats = await getRevisionStats('inv_123')

console.log(stats)
// {
//   totalRevisions: 3,
//   firstProcessedAt: '2024-01-20T10:00:00Z',
//   lastProcessedAt: '2024-01-27T15:00:00Z',
//   processorVersions: ['1.0.0', '1.0.1', '1.1.0'],
//   averageTimeBetweenRevisions: 259200000 // ms (3 Tage)
// }
```

### Revisionen vergleichen

```typescript
import { compareRevisions } from '@/src/lib/invoices/revisions'

const comparison = await compareRevisions('rev_001', 'rev_002')

console.log(comparison)
// {
//   revision1: { id: 'rev_001', processorVersion: '1.0.0', data: {...} },
//   revision2: { id: 'rev_002', processorVersion: '1.1.0', data: {...} },
//   processorVersionChanged: true,
//   timeDifference: 18000000 // ms (5 Stunden)
// }
```

### Zu Revision zurückkehren

```typescript
import { revertToRevision } from '@/src/lib/invoices/revisions'

// Zurück zu alter Version (z.B. Debug)
await revertToRevision('inv_123', 'rev_001')

// Erstellt neue Revision mit Daten von rev_001
// processorVersion: '1.0.0-reverted'
```

### Alte Revisionen löschen

```typescript
import { pruneOldRevisions } from '@/src/lib/invoices/revisions'

// Nur letzte 10 Revisionen behalten
const deletedCount = await pruneOldRevisions('inv_123', 10)

console.log(`${deletedCount} Revisionen gelöscht`)
```

## Re-Processing-Strategien

### 1. Einzelne Invoice re-processen

```typescript
import { reprocessInvoice } from '@/src/lib/invoices/revisions'

// Datei erneut parsen
const rawData = await parseInvoiceFile(upload.storageKey)

// Neue Revision erstellen
await reprocessInvoice(invoice.id, rawData)
```

### 2. Alle Invoices mit alter Version

```typescript
import { getInvoicesNeedingReprocessing } from '@/src/lib/invoices/revisions'

// Alle Invoices mit Version < 1.1.0
const invoices = await getInvoicesNeedingReprocessing('org_123', '1.1.0')

for (const invoice of invoices) {
  try {
    const rawData = await parseInvoiceFile(invoice.upload.storageKey)
    await reprocessInvoice(invoice.id, rawData)
    console.log(`✓ Invoice ${invoice.id} re-processed`)
  } catch (error) {
    console.error(`✗ Invoice ${invoice.id} failed:`, error)
  }
}
```

### 3. Batch Re-Processing mit Queue

```typescript
import { getInvoicesNeedingReprocessing } from '@/src/lib/invoices/revisions'

async function reprocessBatch(organizationId: string, batchSize = 10) {
  const invoices = await getInvoicesNeedingReprocessing(organizationId)

  // Batches von 10
  for (let i = 0; i < invoices.length; i += batchSize) {
    const batch = invoices.slice(i, i + batchSize)

    await Promise.allSettled(
      batch.map(async (invoice) => {
        const rawData = await parseInvoiceFile(invoice.upload.storageKey)
        await reprocessInvoice(invoice.id, rawData)
      })
    )

    console.log(`Batch ${i / batchSize + 1} processed`)
  }
}
```

## Use Cases

### 1. Parser-Bug-Fix

**Szenario:** Bug in Datumsparsing gefunden und gefixt.

```typescript
// 1. Processor-Version erhöhen
// CURRENT_PROCESSOR_VERSION = '1.0.1'

// 2. Alle Invoices re-processen
const invoices = await getInvoicesNeedingReprocessing('org_123', '1.0.1')

for (const invoice of invoices) {
  const rawData = await parseInvoiceFile(invoice.upload.storageKey)
  await reprocessInvoice(invoice.id, rawData)
}

// Alte Daten bleiben erhalten, neue sind in Invoice.rawJson
```

### 2. Neue Felder extrahieren

**Szenario:** Parser soll jetzt auch "Zahlungsbedingungen" extrahieren.

```typescript
// 1. Processor-Version erhöhen
// CURRENT_PROCESSOR_VERSION = '1.1.0'

// 2. Parser erweitern
function parseInvoice(file) {
  return {
    // ... bestehende Felder
    paymentTerms: extractPaymentTerms(file)  // NEU
  }
}

// 3. Alle Invoices re-processen
const invoices = await getInvoicesNeedingReprocessing('org_123', '1.1.0')
// ... re-process
```

### 3. Debugging fehlgeschlagener Verarbeitung

**Szenario:** Invoice ist FAILED, Grund unklar.

```typescript
import { getRevisions } from '@/src/lib/invoices/revisions'

// Alle Revisionen abrufen
const revisions = await getRevisions('inv_123')

// Verschiedene Versionen vergleichen
revisions.forEach(rev => {
  console.log('Version:', rev.processorVersion)
  console.log('Data:', rev.rawJson)
  console.log('---')
})

// Bei Bedarf zu alter Version zurück
await revertToRevision('inv_123', revisions[revisions.length - 1].id)
```

### 4. A/B Testing verschiedener Parser

**Szenario:** Neuen Parser testen, ohne alte Daten zu verlieren.

```typescript
// Parser A (Produktiv)
await markAsParsed(invoice.id, dataA, '1.0.0')

// Parser B (Experimental)
await createRevision({
  invoiceId: invoice.id,
  rawJson: dataB,
  processorVersion: '2.0.0-beta'
})

// Beide Versionen vergleichen
const revisions = await getRevisions(invoice.id)
const dataA = revisions.find(r => r.processorVersion === '1.0.0').rawJson
const dataB = revisions.find(r => r.processorVersion === '2.0.0-beta').rawJson

// Bei Zufriedenheit: Version 2.0.0 als Standard setzen
```

## Performance-Überlegungen

### Storage-Overhead

**Problem:** Jede Revision speichert vollständige rawJson.

**Lösung 1: Pruning**
```typescript
// Alte Revisionen regelmäßig löschen
await pruneOldRevisions(invoice.id, 5)  // Nur 5 behalten
```

**Lösung 2: Selective Revision**
```typescript
// Nur bei Major/Minor-Version neue Revision
function shouldCreateRevision(oldVersion: string, newVersion: string) {
  const [oldMajor, oldMinor] = oldVersion.split('.')
  const [newMajor, newMinor] = newVersion.split('.')

  return oldMajor !== newMajor || oldMinor !== newMinor
}
```

### Query-Performance

**Indizes:**
```sql
-- Bereits vorhanden
CREATE INDEX "InvoiceRevision_invoiceId_idx" ON "InvoiceRevision"("invoiceId");
CREATE INDEX "InvoiceRevision_createdAt_idx" ON "InvoiceRevision"("createdAt");
CREATE INDEX "InvoiceRevision_processorVersion_idx" ON "InvoiceRevision"("processorVersion");
```

**Optimierte Queries:**
```typescript
// Nur IDs und Versionen laden
const versions = await prisma.invoiceRevision.findMany({
  where: { invoiceId },
  select: { id: true, processorVersion: true, createdAt: true },
  orderBy: { createdAt: 'desc' }
})

// rawJson nur bei Bedarf
const fullRevision = await prisma.invoiceRevision.findUnique({
  where: { id: revisionId }
})
```

## Best Practices

### ✅ DO

- Processor-Version bei jeder Parser-Änderung erhöhen
- Alte Revisionen regelmäßig prunen (Retention Policy)
- Re-Processing in Batches (nicht alle auf einmal)
- Revision-Count monitoren (Performance)
- Processor-Version in Semantic Versioning

### ❌ DON'T

- Revision-Tabelle für andere Zwecke nutzen
- Zu viele Revisionen behalten (Storage)
- Invoice.rawJson manuell updaten (immer via createRevision)
- Processor-Version bei UI-Changes erhöhen

## Monitoring

### Wichtige Metriken

```sql
-- Durchschnittliche Anzahl Revisionen pro Invoice
SELECT AVG(revision_count) as avg_revisions
FROM (
  SELECT "invoiceId", COUNT(*) as revision_count
  FROM "InvoiceRevision"
  GROUP BY "invoiceId"
) counts;

-- Invoices mit den meisten Revisionen (potenzielle Probleme)
SELECT "invoiceId", COUNT(*) as revision_count
FROM "InvoiceRevision"
GROUP BY "invoiceId"
ORDER BY revision_count DESC
LIMIT 10;

-- Verteilung nach Processor-Version
SELECT "processorVersion", COUNT(*) as count
FROM "InvoiceRevision"
GROUP BY "processorVersion"
ORDER BY count DESC;

-- Storage-Verbrauch (geschätzt)
SELECT
  pg_size_pretty(pg_total_relation_size('InvoiceRevision')) as table_size;
```

## Datenbank-Schema

```sql
CREATE TABLE "InvoiceRevision" (
  "id" TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "rawJson" JSONB NOT NULL,
  "processorVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),

  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE,

  INDEX ("invoiceId"),
  INDEX ("createdAt"),
  INDEX ("processorVersion")
);
```

## Migration Guide

### Schritt 1: Migration ausführen

```bash
bunx prisma migrate deploy
```

### Schritt 2: Bestehende Invoices migrieren

```typescript
// Alle Invoices mit rawJson, aber ohne Revision
const invoices = await prisma.invoice.findMany({
  where: {
    rawJson: { not: null },
    revisions: { none: {} }
  }
})

// Initial-Revision erstellen
for (const invoice of invoices) {
  await createRevision({
    invoiceId: invoice.id,
    rawJson: invoice.rawJson,
    processorVersion: '1.0.0'  // Initial version
  })
}
```

### Schritt 3: Code aktualisieren

Alle Stellen, die `Invoice.rawJson` direkt updaten, durch `createRevision()` ersetzen.
