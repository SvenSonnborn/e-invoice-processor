# Invoice Processing Flow

Dokumentation zum Invoice-Verarbeitungs-Pipeline mit Status-Tracking.

## Status-Übersicht

Das Invoice-Modell verwendet ein `InvoiceStatus` Enum zur Verfolgung des Verarbeitungsstatus:

```typescript
enum InvoiceStatus {
  UPLOADED   // Datei hochgeladen, noch nicht verarbeitet
  CREATED    // Invoice-Datensatz existiert, noch nicht verarbeitet
  PARSED     // Rohdaten erfolgreich extrahiert
  VALIDATED  // Fachlich validiert (Summen, Pflichtfelder)
  EXPORTED   // Mindestens ein Export erfolgreich erstellt
  FAILED     // Verarbeitung fehlgeschlagen
}
```

## Verarbeitungs-Pipeline

```
┌──────────┐     ┌────────┐     ┌───────────┐     ┌──────────┐
│ UPLOADED │────▶│ PARSED │────▶│ VALIDATED │────▶│ EXPORTED │
└──────────┘     └────────┘     └───────────┘     └──────────┘
     │               │                │                 │
     │               │                │                 │
     └───────────────┴────────────────┴─────────────────┘
                          │
                          ▼
                     ┌────────┐
                     │ FAILED │
                     └────────┘
                          │
                          ▼
                  (Retry → UPLOADED/CREATED)
```

## Automatische OCR-Verarbeitung nach Upload

Nach dem Upload wird OCR automatisch im Hintergrund (fire-and-forget) getriggert:

```
Upload → File + Invoice (UPLOADED) → processInvoiceOcr() → PARSED → VALIDATED
                                                         └→ FAILED (bei Fehler)
```

Die Funktion `processInvoiceOcr()` aus `src/server/services/invoice-processing.ts` orchestriert:

1. Download der Datei aus Supabase Storage
2. OCR-Text-Extraktion (Mock oder Google Cloud Vision)
3. Invoice-Daten parsen
4. Status-Updates: UPLOADED → PARSED → VALIDATED
5. Line Items erstellen
6. Bei Fehler: FAILED setzen mit Fehlermeldung

### Manueller Trigger

OCR kann auch manuell über die API getriggert werden:

```
POST /api/process-invoice/[fileId]
```

Erfordert Authentifizierung und Organisation-Zugehörigkeit. Invoice muss im Status `UPLOADED` oder `CREATED` sein.

## Status-Details

### 1. CREATED

**Beschreibung:** Initialer Status beim Anlegen eines Invoice-Datensatzes.

**Wann:**

- Upload wurde erfolgreich gespeichert
- Invoice-Datensatz wurde in DB erstellt
- Verarbeitung steht noch aus

**Nächster Schritt:** Parsing der Datei

**Felder:**

```typescript
{
  status: 'CREATED',
  lastProcessedAt: null,
  processingVersion: 1,
  rawJson: null
}
```

### 2. PARSED

**Beschreibung:** Rohdaten wurden erfolgreich aus der Datei extrahiert.

**Wann:**

- PDF/XML wurde gelesen
- Struktur wurde erkannt (ZUGFeRD/XRechnung)
- Rohdaten wurden in `rawJson` gespeichert

**Nächster Schritt:** Fachliche Validierung

**Felder:**

```typescript
{
  status: 'PARSED',
  lastProcessedAt: Date,
  processingVersion: 2,
  rawJson: { /* extrahierte Rohdaten */ },
  format: 'ZUGFERD' | 'XRECHNUNG'
}
```

### 3. VALIDATED

**Beschreibung:** Rechnungsdaten wurden fachlich validiert und strukturiert gespeichert.

**Wann:**

- Pflichtfelder vorhanden (Rechnungsnummer, Beträge)
- Summen korrekt (Netto + Steuer = Brutto)
- Datum plausibel
- Strukturierte Felder gefüllt

**Nächster Schritt:** Export

**Felder:**

```typescript
{
  status: 'VALIDATED',
  lastProcessedAt: Date,
  processingVersion: 3,
  number: 'RE-2024-001',
  supplierName: 'Firma ABC',
  customerName: 'Firma XYZ',
  issueDate: Date,
  dueDate: Date,
  netAmount: 1000.00,
  taxAmount: 190.00,
  grossAmount: 1190.00,
  currency: 'EUR'
}
```

### 4. EXPORTED

**Beschreibung:** Rechnung wurde erfolgreich exportiert (mindestens ein Export).

**Wann:**

- CSV-Export wurde erstellt
- DATEV-Export wurde erstellt
- Export-Datensatz existiert in `Export` Tabelle

**Nächster Schritt:** Terminal State (Verarbeitung abgeschlossen)

**Hinweis:** Invoice kann re-validiert und erneut exportiert werden.

### 5. FAILED

**Beschreibung:** Verarbeitung ist fehlgeschlagen.

**Wann:**

- Parsing fehlgeschlagen (ungültiges Format)
- Validierung fehlgeschlagen (fehlende Pflichtfelder, ungültige Summen)
- Technischer Fehler

**Nächster Schritt:** Manueller Retry oder Korrektur

**Felder:**

```typescript
{
  status: 'FAILED',
  lastProcessedAt: Date,
  processingVersion: X,
  // Fehlergrund sollte geloggt werden
}
```

## Status-Transitionen

### Erlaubte Übergänge

```typescript
CREATED    → PARSED, FAILED
PARSED     → VALIDATED, FAILED
VALIDATED  → EXPORTED, FAILED
EXPORTED   → VALIDATED, FAILED  // Re-processing
FAILED     → CREATED            // Retry
```

### Validierung

Verwende `isValidStatusTransition()` um zu prüfen, ob ein Übergang erlaubt ist:

```typescript
import { isValidStatusTransition } from '@/src/lib/invoices/status';

if (!isValidStatusTransition('CREATED', 'EXPORTED')) {
  throw new Error('Invalid transition');
}
```

## Processing Version

Das Feld `processingVersion` wird bei jedem Status-Update inkrementiert:

- **Zweck:** Optimistic Locking, Audit Trail
- **Start:** 1
- **Inkrement:** Bei jedem Status-Update

```typescript
// Beispiel
{
  status: 'CREATED',
  processingVersion: 1  // Initial
}

// Nach Parsing
{
  status: 'PARSED',
  processingVersion: 2  // +1
}

// Nach Validierung
{
  status: 'VALIDATED',
  processingVersion: 3  // +1
}
```

## Last Processed At

Timestamp des letzten Verarbeitungsschritts:

```typescript
{
  lastProcessedAt: '2024-01-27T12:34:56.789Z';
}
```

**Verwendung:**

- Debugging: Wann wurde zuletzt verarbeitet?
- Monitoring: Welche Invoices hängen?
- Retry-Logik: Nur Invoices älter als X Minuten

## Helper-Funktionen

### Status-Management

```typescript
import {
  updateInvoiceStatus,
  markAsParsed,
  markAsValidated,
  markAsExported,
  markAsFailed,
  retryFailedInvoice,
} from '@/src/lib/invoices/processor';

// Status-Update mit Validierung
await updateInvoiceStatus({
  invoiceId: 'inv_123',
  newStatus: 'PARSED',
});

// Convenience-Funktionen
await markAsParsed('inv_123', rawData);
await markAsValidated('inv_123', validatedData);
await markAsExported('inv_123');
await markAsFailed('inv_123', 'Parsing error: Invalid XML');

// Retry
await retryFailedInvoice('inv_123');
```

### Status-Informationen

```typescript
import {
  getStatusLabel,
  getStatusDescription,
  getStatusColor,
  getStatusBadgeClasses,
  isTerminalStatus,
  canProcess,
  getNextStatus,
} from '@/src/lib/invoices/status';

// UI Labels
getStatusLabel('VALIDATED'); // "Validiert"
getStatusDescription('VALIDATED'); // "Rechnungsdaten wurden fachlich validiert"

// UI Styling
getStatusColor('VALIDATED'); // "green"
getStatusBadgeClasses('VALIDATED'); // "inline-flex items-center ... bg-green-100 text-green-800"

// Status-Checks
isTerminalStatus('EXPORTED'); // true
canProcess('FAILED'); // true
getNextStatus('PARSED'); // 'VALIDATED'
```

### Statistiken

```typescript
import { getProcessingStats } from '@/src/lib/invoices/processor';

const stats = await getProcessingStats('org_123');

console.log(stats);
// {
//   total: 100,
//   byStatus: {
//     CREATED: 10,
//     PARSED: 5,
//     VALIDATED: 15,
//     EXPORTED: 65,
//     FAILED: 5
//   },
//   successRate: 65.0,  // % exported
//   failureRate: 5.0    // % failed
// }
```

## Beispiel-Flow

### 1. Upload & Create

```typescript
// Upload-Datei speichern
const upload = await prisma.upload.create({
  data: {
    organizationId: 'org_123',
    filename: 'rechnung.pdf',
    storageKey: 'documents/org_123/file.pdf',
    status: 'PENDING',
  },
});

// Invoice erstellen (CREATED)
const invoice = await prisma.invoice.create({
  data: {
    organizationId: 'org_123',
    uploadId: upload.id,
    status: 'CREATED', // Default
    processingVersion: 1, // Default
  },
});
```

### 2. Parsing

```typescript
try {
  // Datei parsen
  const rawData = await parseInvoiceFile(upload.storageKey);

  // Status: CREATED → PARSED
  await markAsParsed(invoice.id, rawData);

  // Upload als processed markieren
  await prisma.upload.update({
    where: { id: upload.id },
    data: { status: 'PROCESSED' },
  });
} catch (error) {
  await markAsFailed(invoice.id, error.message);
  await prisma.upload.update({
    where: { id: upload.id },
    data: {
      status: 'FAILED',
      errorMessage: error.message,
    },
  });
}
```

### 3. Validation

```typescript
try {
  // Daten validieren
  const validated = await validateInvoiceData(invoice.rawJson);

  // Status: PARSED → VALIDATED
  await markAsValidated(invoice.id, {
    number: validated.number,
    supplierName: validated.supplier,
    customerName: validated.customer,
    issueDate: new Date(validated.issueDate),
    netAmount: validated.netAmount,
    taxAmount: validated.taxAmount,
    grossAmount: validated.grossAmount,
  });
} catch (error) {
  await markAsFailed(invoice.id, error.message);
}
```

### 4. Export

```typescript
// Export erstellen
const exportData = await prisma.export.create({
  data: {
    organizationId: 'org_123',
    format: 'CSV',
    filename: 'export-2024-01.csv',
    storageKey: 'exports/org_123/export.csv',
  },
});

// Invoice zu Export verknüpfen
await prisma.exportInvoice.create({
  data: {
    exportId: exportData.id,
    invoiceId: invoice.id,
  },
});

// Status: VALIDATED → EXPORTED
await markAsExported(invoice.id);
```

## Best Practices

### 1. Immer Status-Transitions validieren

```typescript
// ❌ Falsch
await prisma.invoice.update({
  where: { id },
  data: { status: 'EXPORTED' },
});

// ✅ Richtig
await updateInvoiceStatus({
  invoiceId: id,
  newStatus: 'EXPORTED',
});
```

### 2. Processing Version nutzen

```typescript
// Optimistic Locking
const invoice = await prisma.invoice.findUnique({
  where: { id },
  select: { processingVersion: true },
});

await prisma.invoice.update({
  where: {
    id,
    processingVersion: invoice.processingVersion, // Verhindert race conditions
  },
  data: {
    status: 'PARSED',
    processingVersion: { increment: 1 },
  },
});
```

### 3. Fehlerbehandlung

```typescript
try {
  await processInvoice(invoiceId);
} catch (error) {
  await markAsFailed(invoiceId, error.message);

  // Optional: Error-Log in separater Tabelle
  await prisma.processingError.create({
    data: {
      invoiceId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date(),
    },
  });
}
```

### 4. Monitoring

```typescript
// Hängende Invoices finden (länger als 5 Min in CREATED)
const stuck = await prisma.invoice.findMany({
  where: {
    status: 'CREATED',
    createdAt: {
      lt: new Date(Date.now() - 5 * 60 * 1000),
    },
  },
});
```

## Datenbank-Schema

```sql
-- Invoice Tabelle
CREATE TABLE "Invoice" (
  -- ... andere Felder ...

  -- Status Tracking
  "status" "InvoiceStatus" NOT NULL DEFAULT 'CREATED',
  "lastProcessedAt" TIMESTAMP(3),
  "processingVersion" INTEGER NOT NULL DEFAULT 1,

  -- Index für Performance
  INDEX "Invoice_status_idx" ("status")
)

-- InvoiceStatus Enum
CREATE TYPE "InvoiceStatus" AS ENUM (
  'CREATED',
  'PARSED',
  'VALIDATED',
  'EXPORTED',
  'FAILED'
);
```

## Monitoring Queries

```sql
-- Invoices nach Status
SELECT status, COUNT(*)
FROM "Invoice"
GROUP BY status;

-- Durchschnittliche Verarbeitungszeit
SELECT
  AVG(EXTRACT(EPOCH FROM ("lastProcessedAt" - "createdAt"))) as avg_seconds
FROM "Invoice"
WHERE status = 'EXPORTED';

-- Fehlerrate
SELECT
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'FAILED')::numeric / COUNT(*)) * 100,
    2
  ) as failure_rate
FROM "Invoice";
```
