# Supabase Integration Tests

Skripte zum Testen der Supabase-Integration: Storage (Upload/Download), RLS und DB-Zugriff.

## Preconditions

- Supabase-Projekt läuft
- DB-Schema und RLS-Policies sind aktiv (`setup_rls_policies.sql` angewendet)
- **RLS-Rekursion-Fix:** Danach `fix_rls_recursion.sql` anwenden (oder Migration `fix_rls_recursion_v2`), sonst „infinite recursion“ bei Storage/Invoice.
- Storage-Buckets `documents` und `exports` existieren (`bun run scripts/create-storage-buckets.ts` oder Supabase Dashboard)
- `.env.local` enthält:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (oder `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DIRECT_URL`

## Setup (einmalig)

```bash
bun run supabase:setup
```

Erstellt:

- User A → Organization A (Supabase Auth + App-User + Membership)
- User B → Organization B (Supabase Auth + App-User + Membership)
- Test-Rechnungen für Org A und Org B
- `scripts/supabase/test-config.json` (Org-IDs, User-Credentials für Tests)

`test-config.json` liegt in `.gitignore` (enthält Passwörter).

## Tests

| Step | Script | Erwartung |
|------|--------|-----------|
| **1** | `bun run supabase:test-01` | Upload als User A gelingt; Datei im privaten Bucket; **keine** öffentliche URL |
| **2** | `bun run supabase:test-02` | User A kann eigene Datei lesen (Download + Inhalt) |
| **3** | `bun run supabase:test-03` | User B kann User-A-Datei **nicht** lesen (403 / RLS) |
| **4** | `bun run supabase:test-04` | Abfrage als User B liefert nur Rechnungen von Org B; keine von Org A |

Alle vier Schritte nacheinander:

```bash
bun run supabase:test
```

**Reihenfolge:** Zuerst `supabase:setup`, dann `test-01` (Upload), danach `test-02` und `test-03` (Download). `test-04` ist unabhängig vom Upload.

## Ablauf

1. `supabase:setup` → Test-User, Orgs, Rechnungen, `test-config.json`
2. `test-01` → User A lädt `documents/{orgAId}/test-invoice-a.pdf` hoch
3. `test-02` → User A lädt dieselbe Datei herunter
4. `test-03` → User B versucht, die Org-A-Datei herunterzuladen → Fehler
5. `test-04` → User B fragt `Invoice` ab → nur Org-B-Rechnungen
