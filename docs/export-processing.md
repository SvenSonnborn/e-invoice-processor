# Export Processing & Status Tracking

Dokumentation zum Export-Lifecycle mit Status-Tracking und Fehlerbehandlung.

## Übersicht

Exports durchlaufen verschiedene Status während der Generierung:

```
CREATED → GENERATING → READY
    ↓          ↓
  FAILED ← FAILED
```

## Status-Definitionen

### ExportStatus Enum

```typescript
enum ExportStatus {
  CREATED     // Export wurde erstellt, Generierung steht noch aus
  GENERATING  // Export wird gerade generiert
  READY       // Export erfolgreich erstellt, steht zum Download bereit
  FAILED      // Generierung fehlgeschlagen
}
```

### Status-Übergänge

**Erlaubte Transitionen:**

- `CREATED` → `GENERATING`, `FAILED`
- `GENERATING` → `READY`, `FAILED`
- `READY` → `GENERATING` (Re-Generation erlaubt)
- `FAILED` → `CREATED` (Retry)

**Verbotene Transitionen:**

- `CREATED` → `READY` (muss durch GENERATING)
- `READY` → `FAILED` (nur während Generation)
- Alle anderen direkten Sprünge

## Datenmodell

### Export Tabelle

```typescript
{
  id: string
  organizationId: string
  createdBy: string?           // FK to User (Audit Trail)
  format: ExportFormat         // CSV | DATEV | XRECHNUNG | ZUGFERD
  filename: string
  storageKey: string?          // Supabase Storage Key (gesetzt bei READY)

  // Status Tracking
  status: ExportStatus         // @default(CREATED)
  errorMessage: string?        // Nur bei FAILED, @db.Text für lange Fehler

  createdAt: DateTime
  updatedAt: DateTime

  // Relations
  organization: Organization?
  creator: User?
  invoices: ExportInvoice[]
}
```

**Indizes:**

```sql
CREATE INDEX "Export_organizationId_idx" ON "Export"("organizationId");
CREATE INDEX "Export_format_idx" ON "Export"("format");
CREATE INDEX "Export_status_idx" ON "Export"("status");
CREATE INDEX "Export_createdBy_idx" ON "Export"("createdBy");
```

## Verwendung

### Unterstützte Formate

- `CSV` - Sammel-CSV für mehrere Rechnungen
- `DATEV` - DATEV Buchungsstapel (CSV)
- `XRECHNUNG` - eine Rechnung als XRechnung-XML
- `ZUGFERD` - eine Rechnung als ZUGFeRD PDF/A-3

Hinweis: Für `XRECHNUNG` und `ZUGFERD` wird aktuell genau **eine** Rechnung pro Export unterstützt.

### Direkter Einzel-Export (`/api/export/[invoiceId]`)

Zusätzlich zum Export-Job-Flow (`/api/exports`) gibt es einen direkten Download-Flow für eine einzelne Rechnung:

- `GET /api/export/[invoiceId]?format=xrechnung` erzeugt XRechnung-XML
- `GET /api/export/[invoiceId]?format=zugferd` erzeugt ZUGFeRD-PDF/A-3

Ablauf:

1. Rechnung wird mit `invoiceId + organizationId` geladen (striktes Tenant-Scoping).
2. Format wird validiert (`xrechnung | zugferd`).
3. Datei wird generiert und validiert.
4. Datei wird in Supabase Storage unter `invoices/exports/<organizationId>/<invoiceId>/...` abgelegt.
5. Datei wird als `attachment` gestreamt (direkter Download).
6. Rechnungsstatus wird bei Erfolg auf `EXPORTED` gesetzt.

### Automatische Validierung

Nach der Generierung läuft für `XRECHNUNG`/`ZUGFERD` automatisch eine Validierung:

- Built-in Prüfungen (XML/XSD/Profile, eingebettetes XML, PDF/A-3 Metadaten)
- Optional offizielle CLI-Validatoren über:
  - `XRECHNUNG_VALIDATOR_COMMAND`
  - `ZUGFERD_VALIDATOR_COMMAND`

Bei Validierungsfehlern:

- Exportstatus wird auf `FAILED` gesetzt
- `errorMessage` enthält die detaillierten Validator-Fehler
- Fehler werden serverseitig geloggt

Bei erfolgreicher Validierung:

- Exportstatus wird auf `READY` gesetzt
- Die UI zeigt für `XRECHNUNG`/`ZUGFERD` ein zusätzliches `Validiert`-Badge

### Export erstellen (mit Audit Trail)

```typescript
import { createExport } from '@/src/lib/exports/processor';

const exp = await createExport(
  {
    organizationId: 'org_123',
    format: 'CSV',
    filename: 'export_2024_01.csv',
    invoiceIds: ['inv_1', 'inv_2', 'inv_3'],
  },
  userId // Actor tracking
);

console.log(exp.status); // 'CREATED'
console.log(exp.createdBy); // userId
```

### Status-Updates während Processing

```typescript
import {
  markAsGenerating,
  markAsReady,
  markAsFailed,
} from '@/src/lib/exports/processor';

// 1. Export-Job starten
await markAsGenerating(exportId);

try {
  // 2. Export generieren
  const storageKey = await generateExportFile(exportId);

  // 3. Als bereit markieren
  await markAsReady(exportId, storageKey);
} catch (error) {
  // 4. Bei Fehler markieren
  await markAsFailed(exportId, error.message);
}
```

### Fehlgeschlagenen Export wiederholen

```typescript
import { retryFailedExport } from '@/src/lib/exports/processor';

// Setzt Status zurück auf CREATED
const exp = await retryFailedExport(exportId);

console.log(exp.status); // 'CREATED'
console.log(exp.errorMessage); // null
console.log(exp.storageKey); // null
```

### Pending Exports abrufen

```typescript
import { getPendingExports } from '@/src/lib/exports/processor';

// Alle CREATED Exports für eine Organisation
const pending = await getPendingExports('org_123', 50);

for (const exp of pending) {
  await processExport(exp.id);
}
```

### Stuck Exports erkennen und behandeln

```typescript
import { getStuckExports, failStuckExports } from '@/src/lib/exports/processor';

// Exports, die länger als 30 Minuten in GENERATING sind
const stuck = await getStuckExports(30);

console.log(`Found ${stuck.length} stuck exports`);

// Automatisch als fehlgeschlagen markieren
const failedCount = await failStuckExports(30);

console.log(`Marked ${failedCount} exports as failed`);
```

### Status Validierung

```typescript
import {
  isValidExportStatusTransition,
  canProcessExport,
} from '@/src/lib/exports/status';

// Transition validieren
const valid = isValidExportStatusTransition('CREATED', 'GENERATING');
console.log(valid); // true

// Prüfen ob Export verarbeitet werden kann
const canProcess = canProcessExport('FAILED');
console.log(canProcess); // true (Retry möglich)
```

### UI Helpers

```typescript
import {
  getExportStatusLabel,
  getExportStatusColor,
  getExportStatusBadgeClasses,
} from '@/src/lib/exports/status';

// Deutsches Label
const label = getExportStatusLabel('GENERATING');
console.log(label); // "Wird generiert"

// Farbe für UI
const color = getExportStatusColor('READY');
console.log(color); // "green"

// Tailwind Badge Classes
const classes = getExportStatusBadgeClasses('FAILED');
console.log(classes); // "inline-flex items-center ... bg-red-100 text-red-800"
```

## Export Statistiken

```typescript
import { getExportStats } from '@/src/lib/exports/processor';

const stats = await getExportStats('org_123');

console.log(stats);
// {
//   total: 150,
//   byStatus: {
//     CREATED: 10,
//     GENERATING: 5,
//     READY: 120,
//     FAILED: 15
//   },
//   successRate: '80.00'
// }
```

## Audit Trail

### Actor Tracking

Jeder Export und Invoice speichert, welcher User ihn erstellt hat:

```typescript
// Export mit User verknüpft
const exp = await createExport(exportData, userId);

// Invoice mit User verknüpft (bei Upload/Import)
const invoice = await prisma.invoice.create({
  data: {
    organizationId: 'org_123',
    createdBy: userId, // Wer hat die Rechnung hochgeladen?
    // ...
  },
});
```

### Audit-Abfragen

**Wer hat einen Export erstellt?**

```typescript
const exp = await prisma.export.findUnique({
  where: { id: exportId },
  include: {
    creator: {
      select: { id: true, email: true, name: true },
    },
  },
});

console.log(`Created by: ${exp.creator.email}`);
```

**Alle Exports eines Users:**

```typescript
const exports = await prisma.export.findMany({
  where: { createdBy: userId },
  orderBy: { createdAt: 'desc' },
});
```

**Welche User haben die meisten Exports erstellt?**

```sql
SELECT u.email, COUNT(e.id) as export_count
FROM "Export" e
JOIN "User" u ON e."createdBy" = u.id
WHERE e."organizationId" = 'org_123'
GROUP BY u.email
ORDER BY export_count DESC;
```

## Best Practices

### ✅ DO

- Immer `createExport()` mit `userId` verwenden für Audit Trail
- Status-Transitions mit Helper-Functions durchführen
- Stuck Exports regelmäßig überwachen (Cron Job)
- Error Messages aussagekräftig formulieren
- `storageKey` nur bei READY Status setzen

### ❌ DON'T

- Status nicht manuell mit `prisma.export.update()` ändern (Validierung fehlt)
- Nicht direkt von CREATED zu READY springen
- Error Message nicht bei Erfolgs-Status setzen
- Stuck Exports nicht ignorieren (blockiert Queue)

## Monitoring

### SQL Queries

**Exports nach Status:**

```sql
SELECT status, COUNT(*) as count
FROM "Export"
WHERE "organizationId" = 'org_123'
GROUP BY status;
```

**Failed Exports mit Fehlergrund:**

```sql
SELECT id, filename, "errorMessage", "createdAt"
FROM "Export"
WHERE status = 'FAILED'
ORDER BY "createdAt" DESC
LIMIT 20;
```

**Stuck Exports (länger als 30 Min in GENERATING):**

```sql
SELECT id, filename, "updatedAt",
       EXTRACT(EPOCH FROM (NOW() - "updatedAt"))/60 as minutes_stuck
FROM "Export"
WHERE status = 'GENERATING'
AND "updatedAt" < NOW() - INTERVAL '30 minutes'
ORDER BY "updatedAt" ASC;
```

**Success Rate pro Format:**

```sql
SELECT format,
       COUNT(*) as total,
       SUM(CASE WHEN status = 'READY' THEN 1 ELSE 0 END) as ready,
       ROUND(100.0 * SUM(CASE WHEN status = 'READY' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM "Export"
WHERE "organizationId" = 'org_123'
GROUP BY format;
```

**Durchschnittliche Generierungsdauer:**

```sql
SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as avg_seconds
FROM "Export"
WHERE status = 'READY';
```

## Background Job Integration

### Queue Worker Pattern

```typescript
// worker.ts
import {
  getPendingExports,
  markAsGenerating,
} from '@/src/lib/exports/processor';

async function processExportQueue() {
  const pending = await getPendingExports(undefined, 10);

  for (const exp of pending) {
    try {
      await markAsGenerating(exp.id);
      await generateExport(exp.id);
    } catch (error) {
      console.error(`Failed to process export ${exp.id}:`, error);
    }
  }
}

// Run every minute
setInterval(processExportQueue, 60000);
```

### Stuck Export Cleanup

```typescript
// cleanup.ts
import { failStuckExports } from '@/src/lib/exports/processor';

async function cleanupStuckExports() {
  const count = await failStuckExports(30);
  console.log(`Marked ${count} stuck exports as failed`);
}

// Run every 10 minutes
setInterval(cleanupStuckExports, 600000);
```

## Error Handling

### Fehler-Kategorien

**1. Validierungsfehler (vor Generation):**

```typescript
if (invoiceIds.length === 0) {
  throw new Error('Keine Rechnungen für Export ausgewählt');
}
// Export wird nie als GENERATING markiert
```

**2. Generierungsfehler:**

```typescript
try {
  await markAsGenerating(exportId);
  const data = await fetchInvoiceData(invoiceIds);
  const file = await generateCSV(data);
  const storageKey = await uploadToStorage(file);
  await markAsReady(exportId, storageKey);
} catch (error) {
  await markAsFailed(
    exportId,
    `CSV Generierung fehlgeschlagen: ${error.message}`
  );
}
```

**3. Storage-Fehler:**

```typescript
try {
  const storageKey = await uploadToStorage(file);
  await markAsReady(exportId, storageKey);
} catch (error) {
  await markAsFailed(exportId, `Upload fehlgeschlagen: ${error.message}`);
  // File cleanup falls nötig
}
```

### Retry-Strategien

**Manueller Retry:**

```typescript
// User klickt "Erneut versuchen"
const exp = await retryFailedExport(exportId);
await processExport(exp.id);
```

**Automatischer Retry mit Exponential Backoff:**

```typescript
async function processWithRetry(
  exportId: string,
  attempt = 1,
  maxAttempts = 3
) {
  try {
    await markAsGenerating(exportId);
    await generateExport(exportId);
  } catch (error) {
    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise((resolve) => setTimeout(resolve, delay));
      await retryFailedExport(exportId);
      return processWithRetry(exportId, attempt + 1, maxAttempts);
    } else {
      await markAsFailed(
        exportId,
        `Fehlgeschlagen nach ${maxAttempts} Versuchen: ${error.message}`
      );
    }
  }
}
```

## Beispiel: Vollständiger Export-Flow

```typescript
import {
  createExport,
  markAsGenerating,
  markAsReady,
  markAsFailed,
} from '@/src/lib/exports/processor';

async function handleExportRequest(
  userId: string,
  organizationId: string,
  invoiceIds: string[]
) {
  // 1. Export erstellen (mit Audit Trail)
  const exp = await createExport(
    {
      organizationId,
      format: 'CSV',
      filename: `export_${new Date().toISOString()}.csv`,
      invoiceIds,
    },
    userId
  );

  console.log(`Export ${exp.id} created by user ${userId}`);

  // 2. In Background Queue stellen
  await queueExportJob(exp.id);

  return exp;
}

async function processExport(exportId: string) {
  try {
    // 3. Generation starten
    await markAsGenerating(exportId);

    // 4. Daten laden
    const exp = await prisma.export.findUnique({
      where: { id: exportId },
      include: { invoices: { include: { invoice: true } } },
    });

    // 5. CSV generieren
    const csvContent = generateCSV(exp.invoices);

    // 6. Upload zu Supabase Storage
    const filename = exp.filename;
    const { data, error } = await supabase.storage
      .from('exports')
      .upload(filename, csvContent);

    if (error) throw error;

    // 7. Als bereit markieren
    await markAsReady(exportId, data.path);

    console.log(`Export ${exportId} ready for download`);
  } catch (error) {
    // 8. Bei Fehler markieren
    await markAsFailed(exportId, error.message);
    console.error(`Export ${exportId} failed:`, error);
  }
}
```

## Performance-Optimierungen

### Batch Processing

```typescript
// Statt einzeln:
for (const exp of pending) {
  await processExport(exp.id);
}

// Besser: Parallel (mit Limit):
const BATCH_SIZE = 5;
const batches = chunk(pending, BATCH_SIZE);

for (const batch of batches) {
  await Promise.all(batch.map((exp) => processExport(exp.id)));
}
```

### Indizes nutzen

```typescript
// Effizient durch Index auf status
const pending = await prisma.export.findMany({
  where: { status: 'CREATED' },
});

// Effizient durch Index auf organizationId + status
const orgPending = await prisma.export.findMany({
  where: {
    organizationId: 'org_123',
    status: 'CREATED',
  },
});
```

## Migration von bestehendem Code

Falls bereits Exports ohne Status existieren:

```typescript
// Alle Exports mit storageKey aber ohne Status auf READY setzen
await prisma.export.updateMany({
  where: {
    storageKey: { not: null },
    status: 'CREATED',
  },
  data: { status: 'READY' },
});
```
