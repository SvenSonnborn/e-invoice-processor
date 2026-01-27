# Invoice Line Items

Dokumentation zu strukturierten Rechnungspositionen.

## Übersicht

Line Items speichern einzelne Rechnungspositionen strukturiert:
- Quantity (Menge)
- Unit Price (Einzelpreis)
- Tax Rate (Steuersatz)
- Calculated amounts (Netto, Steuer, Brutto)

**Status:** Optional - Parser füllt sie später aus.

## Datenmodell

```typescript
{
  id: string               // Unique ID
  invoiceId: string        // FK to Invoice
  positionIndex: number    // Reihenfolge (1, 2, 3, ...)
  description: string?     // Positionsbeschreibung
  quantity: number?        // Menge (z.B. 2.5)
  unitPrice: number?       // Einzelpreis netto (z.B. 100.00)
  taxRate: number?         // Steuersatz % (z.B. 19.00)
  netAmount: number?       // Nettobetrag
  taxAmount: number?       // Steuerbetrag
  grossAmount: number?     // Bruttobetrag
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Constraints:**
- `@@unique([invoiceId, positionIndex])` - Keine doppelten Positionen
- `ON DELETE CASCADE` - Bei Invoice-Löschung werden Line Items gelöscht

## Beziehung zu Invoice

```
Invoice 1 ─── N InvoiceLineItem
```

**Beispiel:**
```
Invoice (RE-2024-001)
├── LineItem 1: 2x Produkt A @ 50.00€ = 100.00€
├── LineItem 2: 1x Produkt B @ 75.00€ = 75.00€
└── LineItem 3: 5x Produkt C @ 10.00€ = 50.00€
                                 Summe: 225.00€
```

## Verwendung

### Line Items erstellen

```typescript
import { createLineItems } from '@/src/lib/invoices/line-items'

const items = await createLineItems('inv_123', [
  {
    positionIndex: 1,
    description: 'Produkt A',
    quantity: 2,
    unitPrice: 50.00,
    taxRate: 19,
    netAmount: 100.00,
    taxAmount: 19.00,
    grossAmount: 119.00,
  },
  {
    positionIndex: 2,
    description: 'Produkt B',
    quantity: 1,
    unitPrice: 75.00,
    taxRate: 19,
    netAmount: 75.00,
    taxAmount: 14.25,
    grossAmount: 89.25,
  },
])
```

### Line Items abrufen

```typescript
import { getLineItems } from '@/src/lib/invoices/line-items'

const items = await getLineItems('inv_123')

items.forEach(item => {
  console.log(`${item.positionIndex}. ${item.description}`)
  console.log(`  ${item.quantity}x ${item.unitPrice}€ = ${item.grossAmount}€`)
})
```

### Beträge berechnen

```typescript
import { calculateLineItem } from '@/src/lib/invoices/line-items'

const calculated = calculateLineItem(
  2,      // quantity
  50.00,  // unitPrice
  19      // taxRate (19%)
)

console.log(calculated)
// {
//   quantity: 2,
//   unitPrice: 50.00,
//   taxRate: 19,
//   netAmount: 100.00,
//   taxAmount: 19.00,
//   grossAmount: 119.00
// }
```

### Line Items validieren

```typescript
import { validateLineItem } from '@/src/lib/invoices/line-items'

const validation = validateLineItem({
  positionIndex: 1,
  quantity: 2,
  unitPrice: 50.00,
  taxRate: 19,
  netAmount: 100.00,   // Sollte korrekt sein
  taxAmount: 19.00,    // Sollte korrekt sein
  grossAmount: 119.00  // Sollte korrekt sein
})

if (!validation.valid) {
  console.error('Validation errors:', validation.errors)
}
```

### Rechnungssummen berechnen

```typescript
import { calculateInvoiceTotals } from '@/src/lib/invoices/line-items'

const totals = calculateInvoiceTotals([
  { positionIndex: 1, netAmount: 100.00, taxAmount: 19.00, grossAmount: 119.00 },
  { positionIndex: 2, netAmount: 75.00, taxAmount: 14.25, grossAmount: 89.25 },
])

console.log(totals)
// {
//   netAmount: 175.00,
//   taxAmount: 33.25,
//   grossAmount: 208.25,
//   lineCount: 2
// }
```

### Invoice-Totals validieren

```typescript
import { validateInvoiceTotals } from '@/src/lib/invoices/line-items'

const validation = await validateInvoiceTotals('inv_123')

if (!validation.valid) {
  console.error('Invoice totals do not match line items:')
  validation.errors.forEach(error => console.error('  -', error))
}

console.log('Details:', validation.details)
// {
//   invoiceNetAmount: 175.00,
//   invoiceTaxAmount: 33.25,
//   invoiceGrossAmount: 208.25,
//   lineItemsNetAmount: 175.00,
//   lineItemsTaxAmount: 33.25,
//   lineItemsGrossAmount: 208.25
// }
```

### Line Items ersetzen

```typescript
import { replaceLineItems } from '@/src/lib/invoices/line-items'

// Alle Line Items löschen und durch neue ersetzen
const newItems = await replaceLineItems('inv_123', [
  {
    positionIndex: 1,
    description: 'Neue Position 1',
    quantity: 1,
    unitPrice: 100.00,
    taxRate: 19,
    netAmount: 100.00,
    taxAmount: 19.00,
    grossAmount: 119.00,
  },
])
```

## Integration mit Invoice Processing

### Beim Parsing

```typescript
import { markAsParsed } from '@/src/lib/invoices/processor'
import { createLineItems, calculateLineItem } from '@/src/lib/invoices/line-items'

// 1. Invoice parsen
const rawData = await parseInvoiceFile(upload.storageKey)

// 2. Invoice als PARSED markieren
await markAsParsed(invoice.id, rawData)

// 3. Line Items aus rawData extrahieren (wenn vorhanden)
if (rawData.lineItems && Array.isArray(rawData.lineItems)) {
  const items = rawData.lineItems.map((item, index) => {
    const calculated = calculateLineItem(
      item.quantity,
      item.unitPrice,
      item.taxRate
    )

    return {
      positionIndex: index + 1,
      description: item.description,
      ...calculated,
    }
  })

  await createLineItems(invoice.id, items)
}
```

### Bei Validierung

```typescript
import { markAsValidated } from '@/src/lib/invoices/processor'
import { validateInvoiceTotals } from '@/src/lib/invoices/line-items'

// 1. Line Items validieren
const validation = await validateInvoiceTotals(invoice.id)

if (!validation.valid) {
  throw new Error('Invoice totals do not match line items')
}

// 2. Invoice als VALIDATED markieren
await markAsValidated(invoice.id, {
  // ... andere Felder
  netAmount: validation.details.lineItemsNetAmount,
  taxAmount: validation.details.lineItemsTaxAmount,
  grossAmount: validation.details.lineItemsGrossAmount,
})
```

## Beispiele

### Beispiel 1: Einfache Rechnung

```typescript
// Rechnung mit 3 Positionen
const invoice = {
  number: 'RE-2024-001',
  supplierName: 'Firma ABC',
  customerName: 'Kunde XYZ',
}

const lineItems = [
  {
    positionIndex: 1,
    description: 'Beratungsleistung (2 Stunden)',
    quantity: 2,
    unitPrice: 150.00,
    taxRate: 19,
    netAmount: 300.00,
    taxAmount: 57.00,
    grossAmount: 357.00,
  },
  {
    positionIndex: 2,
    description: 'Reisekosten',
    quantity: 1,
    unitPrice: 50.00,
    taxRate: 19,
    netAmount: 50.00,
    taxAmount: 9.50,
    grossAmount: 59.50,
  },
  {
    positionIndex: 3,
    description: 'Spesen',
    quantity: 1,
    unitPrice: 25.00,
    taxRate: 19,
    netAmount: 25.00,
    taxAmount: 4.75,
    grossAmount: 29.75,
  },
]

await createLineItems(invoice.id, lineItems)

// Summe: 375.00€ netto + 71.25€ Steuer = 446.25€ brutto
```

### Beispiel 2: Verschiedene Steuersätze

```typescript
// Rechnung mit verschiedenen Steuersätzen (19% und 7%)
const lineItems = [
  {
    positionIndex: 1,
    description: 'Software-Lizenz',
    quantity: 1,
    unitPrice: 1000.00,
    taxRate: 19,
    netAmount: 1000.00,
    taxAmount: 190.00,
    grossAmount: 1190.00,
  },
  {
    positionIndex: 2,
    description: 'Buch (ermäßigter Steuersatz)',
    quantity: 2,
    unitPrice: 20.00,
    taxRate: 7,
    netAmount: 40.00,
    taxAmount: 2.80,
    grossAmount: 42.80,
  },
]

await createLineItems(invoice.id, lineItems)

// Summe: 1040.00€ netto + 192.80€ Steuer = 1232.80€ brutto
```

### Beispiel 3: Bruchzahlen (Mengen)

```typescript
// Rechnung mit Bruchzahlen (z.B. Stunden, kg)
const lineItems = [
  {
    positionIndex: 1,
    description: 'Beratung (2.5 Stunden)',
    quantity: 2.5,      // Bruchzahl
    unitPrice: 120.00,
    taxRate: 19,
    netAmount: 300.00,
    taxAmount: 57.00,
    grossAmount: 357.00,
  },
  {
    positionIndex: 2,
    description: 'Material (1.75 kg)',
    quantity: 1.75,     // Bruchzahl
    unitPrice: 40.00,
    taxRate: 19,
    netAmount: 70.00,
    taxAmount: 13.30,
    grossAmount: 83.30,
  },
]

await createLineItems(invoice.id, lineItems)
```

## Statistiken

```typescript
import { getLineItemStats } from '@/src/lib/invoices/line-items'

const stats = await getLineItemStats('inv_123')

console.log(stats)
// {
//   count: 3,
//   totalNet: 375.00,
//   totalTax: 71.25,
//   totalGross: 446.25,
//   averageNetAmount: 125.00,
//   maxNetAmount: 300.00,
//   minNetAmount: 25.00
// }
```

## Hinweise

### Precision & Rounding

**Decimal-Typen:**
- `quantity`: DECIMAL(18, 4) - Bis zu 4 Nachkommastellen
- `unitPrice`: DECIMAL(18, 4) - Bis zu 4 Nachkommastellen
- `taxRate`: DECIMAL(5, 2) - Bis zu 2 Nachkommastellen (z.B. 19.00)
- `netAmount`, `taxAmount`, `grossAmount`: DECIMAL(18, 2) - Standard Währungspräzision

**Rundung:**
```typescript
// Runden auf 2 Nachkommastellen
Number(amount.toFixed(2))
```

### Validierung

**Toleranz:** 0.01€ (1 Cent) für Rundungsdifferenzen.

```typescript
const diff = Math.abs(calculated - actual)
if (diff > 0.01) {
  // Fehler: Differenz zu groß
}
```

### Performance

**Indizes:**
```sql
-- Bereits vorhanden
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");
CREATE INDEX "InvoiceLineItem_positionIndex_idx" ON "InvoiceLineItem"("positionIndex");
CREATE UNIQUE INDEX "InvoiceLineItem_invoiceId_positionIndex_key" ON "InvoiceLineItem"("invoiceId", "positionIndex");
```

**Batch-Operationen:**
```typescript
// Effizienter als einzelne Inserts
await createLineItems(invoiceId, [item1, item2, item3])

// Statt:
await createLineItems(invoiceId, [item1])
await createLineItems(invoiceId, [item2])
await createLineItems(invoiceId, [item3])
```

## Best Practices

### ✅ DO

- Position Index bei 1 starten (nicht 0)
- Line Items berechnen mit `calculateLineItem()`
- Totals validieren mit `validateInvoiceTotals()`
- Replace statt Delete + Create nutzen
- Batch-Operationen für Performance

### ❌ DON'T

- Position Index manuell vergeben (anfällig für Duplikate)
- Beträge manuell berechnen (Rundungsfehler)
- Invoice.netAmount ohne Line Items setzen (Inkonsistenz)
- Zu viele einzelne Inserts (Performance)

## Migration

### Bestehende Invoices ohne Line Items

Für bereits geparste Invoices können Line Items nachträglich extrahiert werden:

```typescript
const invoices = await prisma.invoice.findMany({
  where: {
    status: { in: ['PARSED', 'VALIDATED', 'EXPORTED'] },
    lineItems: { none: {} }  // Keine Line Items
  }
})

for (const invoice of invoices) {
  if (invoice.rawJson?.lineItems) {
    // Line Items aus rawJson extrahieren
    const items = extractLineItemsFromRawJson(invoice.rawJson)
    await createLineItems(invoice.id, items)
  }
}
```

## Monitoring

```sql
-- Invoices ohne Line Items
SELECT COUNT(*)
FROM "Invoice" i
LEFT JOIN "InvoiceLineItem" li ON li."invoiceId" = i."id"
WHERE i."status" IN ('PARSED', 'VALIDATED', 'EXPORTED')
AND li."id" IS NULL;

-- Durchschnittliche Anzahl Line Items
SELECT AVG(line_count) as avg_line_items
FROM (
  SELECT "invoiceId", COUNT(*) as line_count
  FROM "InvoiceLineItem"
  GROUP BY "invoiceId"
) counts;

-- Invoices mit inkonsistenten Summen
SELECT i."id", i."grossAmount" as invoice_total,
       SUM(li."grossAmount") as line_items_total
FROM "Invoice" i
JOIN "InvoiceLineItem" li ON li."invoiceId" = i."id"
GROUP BY i."id", i."grossAmount"
HAVING ABS(i."grossAmount" - SUM(li."grossAmount")) > 0.01;
```
