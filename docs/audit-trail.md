# Audit Trail & Actor Tracking

Dokumentation zur Nachverfolgbarkeit von Aktionen und Datenänderungen.

## Übersicht

Das System trackt automatisch, welcher User bestimmte Aktionen durchgeführt hat:

- Welcher User hat eine Rechnung hochgeladen/importiert?
- Welcher User hat einen Export erstellt?

## Datenmodell

### Betroffene Tabellen

**Invoice:**

```typescript
{
  id: string
  createdBy: string?  // FK to User
  // ...
  creator: User?      // Relation
}
```

**Export:**

```typescript
{
  id: string
  createdBy: string?  // FK to User
  // ...
  creator: User?      // Relation
}
```

**User:**

```typescript
{
  id: string
  email: string
  name: string?
  // ...
  createdInvoices: Invoice[]  // Reverse relation
  createdExports: Export[]    // Reverse relation
}
```

### Foreign Keys

```sql
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Export"
  ADD CONSTRAINT "Export_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

**ON DELETE SET NULL:** Wenn ein User gelöscht wird, bleibt der Invoice/Export erhalten, aber `createdBy` wird auf `null` gesetzt.

## Verwendung

### Invoice mit Actor Tracking erstellen

```typescript
import { getServerSession } from '@/src/lib/auth/session';

// In Server Action oder API Route
const session = await getServerSession();

if (!session?.user) {
  throw new Error('Unauthorized');
}

const invoice = await prisma.invoice.create({
  data: {
    organizationId: 'org_123',
    createdBy: session.user.id, // Actor tracking
    uploadId: upload.id,
    format: 'ZUGFERD',
    // ...
  },
});
```

### Export mit Actor Tracking erstellen

```typescript
import { createExport } from '@/src/lib/exports/processor';

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

### Creator-Informationen abrufen

```typescript
// Invoice mit Creator
const invoice = await prisma.invoice.findUnique({
  where: { id: invoiceId },
  include: {
    creator: {
      select: {
        id: true,
        email: true,
        name: true,
      },
    },
  },
});

if (invoice.creator) {
  console.log(`Hochgeladen von: ${invoice.creator.email}`);
  console.log(`Name: ${invoice.creator.name}`);
} else {
  console.log('Creator unbekannt (User gelöscht oder Migration)');
}
```

```typescript
// Export mit Creator
const exp = await prisma.export.findUnique({
  where: { id: exportId },
  include: {
    creator: {
      select: { email: true, name: true },
    },
  },
});

console.log(`Export erstellt von: ${exp.creator?.email ?? 'Unbekannt'}`);
```

### Alle Invoices eines Users

```typescript
const invoices = await prisma.invoice.findMany({
  where: { createdBy: userId },
  orderBy: { createdAt: 'desc' },
});

console.log(`User hat ${invoices.length} Rechnungen hochgeladen`);
```

### Alle Exports eines Users

```typescript
const exports = await prisma.export.findMany({
  where: { createdBy: userId },
  orderBy: { createdAt: 'desc' },
});

console.log(`User hat ${exports.length} Exports erstellt`);
```

## Audit-Abfragen

### Aktivitätslog eines Users

```typescript
const userId = 'user_123';

const [invoices, exports] = await Promise.all([
  prisma.invoice.findMany({
    where: { createdBy: userId },
    select: {
      id: true,
      number: true,
      supplierName: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  }),
  prisma.export.findMany({
    where: { createdBy: userId },
    select: {
      id: true,
      filename: true,
      format: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  }),
]);

console.log('User Activity:');
console.log(`- ${invoices.length} Invoices hochgeladen`);
console.log(`- ${exports.length} Exports erstellt`);
```

### Top Contributors (Organisation)

```sql
-- User mit den meisten hochgeladenen Rechnungen
SELECT
  u.email,
  u.name,
  COUNT(i.id) as invoice_count
FROM "Invoice" i
JOIN "User" u ON i."createdBy" = u.id
WHERE i."organizationId" = 'org_123'
GROUP BY u.id, u.email, u.name
ORDER BY invoice_count DESC
LIMIT 10;
```

```sql
-- User mit den meisten Exports
SELECT
  u.email,
  u.name,
  COUNT(e.id) as export_count
FROM "Export" e
JOIN "User" u ON e."createdBy" = u.id
WHERE e."organizationId" = 'org_123'
GROUP BY u.id, u.email, u.name
ORDER BY export_count DESC
LIMIT 10;
```

### Aktivität über Zeit

```sql
-- Invoices pro User pro Monat
SELECT
  u.email,
  DATE_TRUNC('month', i."createdAt") as month,
  COUNT(i.id) as invoice_count
FROM "Invoice" i
JOIN "User" u ON i."createdBy" = u.id
WHERE i."organizationId" = 'org_123'
GROUP BY u.email, month
ORDER BY month DESC, invoice_count DESC;
```

### Orphaned Records (Creator gelöscht)

```sql
-- Invoices ohne Creator
SELECT COUNT(*) as orphaned_invoices
FROM "Invoice"
WHERE "createdBy" IS NULL
AND "organizationId" = 'org_123';

-- Exports ohne Creator
SELECT COUNT(*) as orphaned_exports
FROM "Export"
WHERE "createdBy" IS NULL
AND "organizationId" = 'org_123';
```

### User-Löschung Impact Analysis

```typescript
// Vor User-Löschung: Analyse durchführen
async function analyzeUserDeletion(userId: string) {
  const [invoiceCount, exportCount, orgMemberships] = await Promise.all([
    prisma.invoice.count({ where: { createdBy: userId } }),
    prisma.export.count({ where: { createdBy: userId } }),
    prisma.organizationMember.count({ where: { userId } }),
  ]);

  return {
    invoices: invoiceCount,
    exports: exportCount,
    organizations: orgMemberships,
    impact: `User hat ${invoiceCount} Rechnungen und ${exportCount} Exports erstellt`,
  };
}

// Bei Löschung werden createdBy Felder auf NULL gesetzt (ON DELETE SET NULL)
```

## UI Integration

### Creator Badge anzeigen

```tsx
import { prisma } from '@/src/lib/db/client';

export async function InvoiceCard({ invoiceId }: { invoiceId: string }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { creator: { select: { email: true, name: true } } },
  });

  return (
    <div className="border rounded p-4">
      <h3>{invoice.number}</h3>
      <p>{invoice.supplierName}</p>

      {invoice.creator && (
        <div className="text-sm text-gray-500 mt-2">
          Hochgeladen von: {invoice.creator.name ?? invoice.creator.email}
        </div>
      )}
    </div>
  );
}
```

### Activity Feed

```tsx
export async function UserActivityFeed({ userId }: { userId: string }) {
  const [invoices, exports] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        number: true,
        supplierName: true,
        createdAt: true,
      },
    }),
    prisma.export.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        filename: true,
        format: true,
        createdAt: true,
      },
    }),
  ]);

  // Merge and sort by date
  const activities = [
    ...invoices.map((inv) => ({ type: 'invoice', ...inv })),
    ...exports.map((exp) => ({ type: 'export', ...exp })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="space-y-2">
      <h3 className="font-bold">Letzte Aktivitäten</h3>
      {activities.map((activity) => (
        <div key={activity.id} className="border-l-2 pl-3 py-2">
          {activity.type === 'invoice' ? (
            <div>
              <span className="text-blue-600">Rechnung hochgeladen</span>
              <p className="text-sm">
                {activity.number} - {activity.supplierName}
              </p>
              <p className="text-xs text-gray-500">
                {activity.createdAt.toLocaleString()}
              </p>
            </div>
          ) : (
            <div>
              <span className="text-green-600">Export erstellt</span>
              <p className="text-sm">
                {activity.filename} ({activity.format})
              </p>
              <p className="text-xs text-gray-500">
                {activity.createdAt.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

## RLS Policies (Supabase)

Bereits in `setup_rls_policies.sql` enthalten:

```sql
-- Invoice: Users können nur eigene Invoices sehen (über OrganizationMember)
CREATE POLICY "Users can select invoices via organization membership"
  ON "Invoice" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "Invoice"."organizationId"
      AND om."userId" = (
        SELECT id FROM "User" WHERE "supabaseUserId" = auth.uid()
      )
    )
  );

-- Export: Users können nur Exports ihrer Orga sehen
CREATE POLICY "Users can select exports via organization membership"
  ON "Export" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "Export"."organizationId"
      AND om."userId" = (
        SELECT id FROM "User" WHERE "supabaseUserId" = auth.uid()
      )
    )
  );
```

**Wichtig:** RLS prüft auf Organization-Membership, nicht auf Creator. Ein User kann alle Invoices/Exports seiner Organisation sehen, nicht nur seine eigenen.

## Best Practices

### ✅ DO

- **Immer `createdBy` setzen** bei neuen Invoices und Exports
- **Session validieren** bevor Actor ID gesetzt wird
- **Creator optional abfragen** (kann null sein bei alten Records)
- **Indizes nutzen** für Performance bei Audit-Queries
- **Impact Analysis** vor User-Löschung durchführen

### ❌ DON'T

- Nicht `createdBy` hardcoden oder raten
- Nicht `createdBy` überschreiben nach Erstellung
- Nicht davon ausgehen dass `createdBy` immer gesetzt ist (nullable!)
- Nicht RLS umgehen um nur eigene Records zu sehen (Policy prüft Orga)

## Datenschutz & DSGVO

### Right to be Forgotten

Bei User-Löschung (DSGVO Art. 17):

```typescript
async function deleteUserGDPR(userId: string) {
  // 1. Impact Analysis
  const analysis = await analyzeUserDeletion(userId);
  console.log(`Lösche User mit Impact: ${analysis.impact}`);

  // 2. Anonymisiere persönliche Daten
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@example.com`,
      name: 'Gelöschter Nutzer',
      supabaseUserId: null,
    },
  });

  // 3. Foreign Keys setzen createdBy automatisch auf NULL (ON DELETE SET NULL)
  //    wenn User physisch gelöscht wird

  // Option A: Soft Delete (empfohlen)
  // User bleibt als "Gelöschter Nutzer" erhalten
  // Invoices/Exports behalten Reference

  // Option B: Hard Delete
  await prisma.user.delete({ where: { id: userId } });
  // createdBy wird automatisch auf NULL gesetzt
}
```

### Audit Log Export

```typescript
async function exportUserAuditLog(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      createdInvoices: {
        select: {
          id: true,
          number: true,
          supplierName: true,
          createdAt: true,
        },
      },
      createdExports: {
        select: {
          id: true,
          filename: true,
          format: true,
          createdAt: true,
        },
      },
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    activities: {
      invoices: user.createdInvoices,
      exports: user.createdExports,
    },
  };
}
```

## Erweiterungen

### Zukünftige Audit-Felder

**Mögliche Erweiterungen:**

```typescript
// Invoice
{
  createdBy: string?     // ✅ Bereits implementiert
  updatedBy: string?     // Wer hat zuletzt geändert?
  deletedBy: string?     // Wer hat gelöscht? (Soft Delete)
  deletedAt: DateTime?   // Wann gelöscht?
}

// Export
{
  createdBy: string?     // ✅ Bereits implementiert
  cancelledBy: string?   // Wer hat abgebrochen?
  cancelledAt: DateTime? // Wann abgebrochen?
}
```

### Full Audit Log Table

Für vollständiges Audit Logging könnte eine separate Tabelle erstellt werden:

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String   // 'invoice.create', 'export.create', 'invoice.update', etc.
  entityId  String   // ID of affected entity
  entityType String  // 'Invoice', 'Export', etc.
  metadata  Json?    // Additional context
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

## Monitoring

### Dashboards

**Aktivitäts-Metriken:**

```sql
-- Uploads pro User (letzte 30 Tage)
SELECT
  u.email,
  COUNT(i.id) as uploads_last_30d
FROM "Invoice" i
JOIN "User" u ON i."createdBy" = u.id
WHERE i."createdAt" > NOW() - INTERVAL '30 days'
GROUP BY u.email
ORDER BY uploads_last_30d DESC;

-- Exports pro User (letzte 30 Tage)
SELECT
  u.email,
  COUNT(e.id) as exports_last_30d
FROM "Export" e
JOIN "User" u ON e."createdBy" = u.id
WHERE e."createdAt" > NOW() - INTERVAL '30 days'
GROUP BY u.email
ORDER BY exports_last_30d DESC;
```

**Compliance-Check:**

```sql
-- Records ohne Creator (für Audit-Zwecke problematisch)
SELECT
  'Invoice' as entity_type,
  COUNT(*) as count_without_creator
FROM "Invoice"
WHERE "createdBy" IS NULL

UNION ALL

SELECT
  'Export' as entity_type,
  COUNT(*) as count_without_creator
FROM "Export"
WHERE "createdBy" IS NULL;
```

## Migration von bestehendem Code

Falls bereits Invoices/Exports ohne `createdBy` existieren:

```typescript
// Option 1: Setze auf System-User
const systemUser = await prisma.user.findFirst({
  where: { email: 'system@example.com' },
});

await prisma.invoice.updateMany({
  where: { createdBy: null },
  data: { createdBy: systemUser.id },
});

// Option 2: Lasse NULL (okay für Legacy-Daten)
// Nur neue Records müssen createdBy haben
```
