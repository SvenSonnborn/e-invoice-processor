# E-Rechnung Setup Guide

Vollständige Anleitung zur Einrichtung der E-Rechnung-Anwendung mit Supabase.

## Voraussetzungen

- [Bun](https://bun.sh/) installiert (v1.0+)
- [Node.js](https://nodejs.org/) (v18+) - optional, Bun reicht
- Supabase-Account ([https://supabase.com](https://supabase.com))
- Git

## 1. Repository klonen

```bash
git clone <repository-url>
cd e-rechnung
```

## 2. Dependencies installieren

```bash
bun install
```

## 3. Supabase Projekt erstellen

1. Gehe zu [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Klicke auf "New Project"
3. Wähle eine Organisation
4. Gib folgende Details ein:
   - **Name:** e-rechnung (oder beliebig)
   - **Database Password:** Starkes Passwort (wird später benötigt)
   - **Region:** Wähle die nächstgelegene Region (z.B. `eu-central-1`)
5. Klicke auf "Create new project"
6. Warte bis das Projekt vollständig erstellt ist (~2 Minuten)

## 4. Umgebungsvariablen konfigurieren

### 4.1 `.env.local` erstellen

```bash
cp .env.example .env.local
```

### 4.2 Supabase Credentials ausfüllen

Öffne `.env.local` und fülle folgende Werte aus:

**In Supabase Dashboard → Settings → API:**

```bash
# Supabase URL (z.B. https://abc123.supabase.co)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co

# Publishable Key (anon key)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY_HERE

# Service Role Key (GEHEIM!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...YOUR_SERVICE_ROLE_KEY
```

**In Supabase Dashboard → Settings → Database:**

```bash
# Connection Pooling URL (für Runtime)
DATABASE_URL=postgresql://postgres.YOUR_REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

# Direct Connection URL (für Migrations)
DIRECT_URL=postgresql://postgres:PASSWORD@db.YOUR_REF.supabase.co:5432/postgres
```

**Site URL (für Entwicklung):**

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 5. Datenbank-Migrations ausführen

```bash
# Mit korrekter DIRECT_URL aus .env.local
DIRECT_URL="postgresql://postgres:PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" bunx prisma migrate deploy

# Prisma Client generieren
DIRECT_URL="postgresql://postgres:PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" bunx prisma generate
```

## 6. Row Level Security (RLS) Policies einrichten

```bash
bun scripts/setup-rls.ts
```

Dieser Befehl:
- Aktiviert RLS auf allen Tabellen
- Erstellt Policies für Multi-Tenant-Isolation
- Richtet Storage-Policies ein

**Ausgabe:**
```
📊 Connecting to database...
🔒 Executing RLS policies...
✅ RLS policies successfully applied!
```

## 7. Supabase Storage Buckets erstellen

### Option A: Über Supabase Dashboard (empfohlen)

1. Gehe zu Supabase Dashboard → Storage
2. Klicke auf "New bucket"

**Bucket 1: `documents`**
- Name: `documents`
- Public: ❌ (Private)
- File size limit: `52428800` (50MB)
- Allowed MIME types: `application/pdf,application/xml,text/xml`

**Bucket 2: `exports`**
- Name: `exports`
- Public: ❌ (Private)
- File size limit: `10485760` (10MB)
- Allowed MIME types: `text/csv,application/zip`

### Option B: Über SQL Editor

Im Supabase SQL Editor ausführen:

```sql
-- Documents Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY['application/pdf', 'application/xml', 'text/xml']
);

-- Exports Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  10485760,
  ARRAY['text/csv', 'application/zip']
);
```

## 8. Supabase Auth konfigurieren

### 8.1 Email Provider aktivieren

1. Gehe zu Supabase Dashboard → Authentication → Providers
2. Aktiviere **Email** Provider
3. Konfiguriere folgende Einstellungen:
   - ✅ **Enable Email Provider**
   - ✅ **Confirm Email** (Pflicht vor Login)
   - ✅ **Secure Email Change**
   - ❌ **Enable Email OTP** (optional, später)

### 8.2 Site URL konfigurieren

1. Gehe zu Authentication → URL Configuration
2. **Site URL:** `http://localhost:3000`
3. **Redirect URLs:** Füge hinzu:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/**` (für alle Unterseiten)

### 8.3 Email Templates anpassen (optional)

1. Gehe zu Authentication → Email Templates
2. Passe die Templates auf Deutsch an:

**Confirm Signup:**
```
Betreff: Bestätigen Sie Ihre E-Mail-Adresse

Hallo,

bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren:

{{ .ConfirmationURL }}

Dieser Link ist 24 Stunden gültig.
```

**Reset Password:**
```
Betreff: Passwort zurücksetzen

Hallo,

Sie haben eine Passwort-Zurücksetzen-Anfrage gestellt. Klicken Sie auf den folgenden Link:

{{ .ConfirmationURL }}

Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.
```

## 9. Entwicklungsserver starten

```bash
bun dev
```

Die Anwendung ist jetzt unter [http://localhost:3000](http://localhost:3000) erreichbar.

## 10. Erste Schritte

### Registrierung testen

1. Öffne [http://localhost:3000/signup](http://localhost:3000/signup)
2. Registriere einen neuen User:
   - Name: Ihr Name
   - E-Mail: ihre@email.de
   - Passwort: mindestens 6 Zeichen
3. Prüfe deine E-Mails (Supabase sendet Confirmation Email)
4. Klicke auf den Bestätigungslink
5. Logge dich ein unter [http://localhost:3000/login](http://localhost:3000/login)

### Organisation erstellen

1. Nach dem Login wirst du zum Onboarding weitergeleitet
2. Gib einen Organisationsnamen ein (mind. 3 Zeichen)
3. Klicke auf "Organisation erstellen"
4. Du wirst zum Dashboard weitergeleitet

### Multi-Org testen

1. Klicke auf den Organization Switcher (oben rechts)
2. Wähle "+ Neue Organisation erstellen"
3. Erstelle eine zweite Organisation
4. Wechsle zwischen Organisationen über den Switcher

## 11. Produktions-Deployment

### Umgebungsvariablen für Produktion

```bash
# Site URL auf Production-Domain setzen
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Database URLs bleiben gleich (Supabase)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Supabase Credentials bleiben gleich
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Redirect URLs aktualisieren

In Supabase Dashboard → Authentication → URL Configuration:
- Füge Production-URLs hinzu: `https://yourdomain.com/auth/callback`

### Build erstellen

```bash
bun run build
```

## GitHub Actions / Deployment

Der Deploy-Workflow (`.github/workflows/deploy.yml`) läuft nach erfolgreicher CI auf `main` und nutzt das GitHub Environment **production**.

### Environment einrichten

1. Im Repository: **Settings** → **Environments** → Environment **production** anlegen (falls noch nicht vorhanden).
2. Unter **Environment secrets** folgende Secrets anlegen (Werte wie in `.env.local`, aber für die Production-Umgebung):

| Secret-Name | Beschreibung |
|-------------|--------------|
| `DATABASE_URL` | Connection-Pooling-URL (Supabase → Settings → Database) |
| `DIRECT_URL` | Direct-Connection-URL für Migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable/Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (geheim) |
| `NEXT_PUBLIC_SITE_URL` | Production-URL der App (z.B. `https://yourdomain.com`) |

Die CI-Workflow-Datei (`.github/workflows/ci.yml`) verwendet weiterhin Dummy-Werte und benötigt keine GitHub Secrets.

## Troubleshooting

### Problem: "Email not confirmed"

**Lösung:** Prüfe deine E-Mails und klicke auf den Bestätigungslink. Falls keine E-Mail angekommen ist:
1. Prüfe Spam-Ordner
2. In Supabase Dashboard → Authentication → Users: Manuell Email als "confirmed" markieren

### Problem: "Cannot resolve environment variable: DIRECT_URL"

**Lösung:** Stelle sicher, dass `.env.local` existiert und `DIRECT_URL` korrekt gesetzt ist. Führe Prisma-Befehle mit expliziter Umgebungsvariable aus:

```bash
DIRECT_URL="postgresql://..." bunx prisma migrate dev
```

### Problem: RLS Policy Fehler beim Query

**Lösung:** Prüfe, ob RLS Policies korrekt erstellt wurden:

```bash
bun scripts/setup-rls.ts
```

Oder manuell im Supabase SQL Editor prüfen:

```sql
SELECT * FROM pg_policies WHERE tablename = 'User';
```

### Problem: "User not found" nach Login

**Lösung:** Stelle sicher, dass beim Sign-Up ein User-Eintrag in der Datenbank erstellt wurde. Prüfe:

```sql
SELECT * FROM "User" WHERE "supabaseUserId" = 'SUPABASE_USER_ID';
```

## Weitere Dokumentation

### Supabase & Database
- [Supabase RLS Runbook](./runbooks/supabase-rls.md) - Detaillierte Erklärung der RLS Policies
- [Prisma Schema](../prisma/schema.prisma) - Datenbank-Schema

### Invoice Processing
- [Invoice Processing](./invoice-processing.md) - Status-Tracking und Workflow
- [Invoice Revisions](./invoice-revisions.md) - Versionierung und Re-Processing
- [Invoice Line Items](./invoice-line-items.md) - Strukturierte Rechnungspositionen

### Export System
- [Export Processing](./export-processing.md) - Export Status-Tracking und Fehlerbehandlung
- [Audit Trail](./audit-trail.md) - Actor Tracking und Nachverfolgbarkeit
