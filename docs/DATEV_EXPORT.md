# DATEV Export Format

Dieses Dokument beschreibt den DATEV CSV Export für das E-Invoice Processor System.

## Überblick

Der DATEV Export implementiert das **Standard Buchungsstapel CSV Format** von DATEV, das kompatibel mit DATEV Unternehmen Online und anderen DATEV-konformen Buchhaltungssystemen ist.

## Format-Spezifikation

### Zeichensatz
- **UTF-8 mit BOM** (Byte Order Mark) - wichtig für DATEV-Kompatibilität

### Trennzeichen
- **Semikolon (;)** als Feldtrennzeichen
- **CRLF (\r\n)** als Zeilenumbruch

### Dezimaltrennzeichen
- **Komma (,)** für Dezimalzahlen (z.B. `1234,56`)

## CSV-Struktur

### Zeile 1: Header (EXTFD)
```
EXTFD;Beraternummer;Mandantennummer;WJ-Beginn;Belegdatum;Bezeichnung;Diktatnr;Buchungstyp;Rechnungswesen;...
```

### Zeile 2: Spaltenüberschriften
Alle DATEV-Standardfelder wie definiert in der DATEV Dokumentation.

### Zeile 3+: Buchungsdaten
Die eigentlichen Buchungszeilen.

## Feldmapping

### Konto (Sachkonto)
| Rechnungstyp | Standardkonto | Beschreibung |
|--------------|---------------|--------------|
| Eingangsrechnung | 4900 | Allgemeiner Aufwand |
| Ausgangsrechnung | 8400 | Umsatzerlöse |

**Konfigurierbar** über `defaultExpenseAccount` und `defaultRevenueAccount`

### Gegenkonto
Standard: **1200** (Bank)

Konfigurierbar über `defaultContraAccount`

### Soll/Haben-Kennzeichen
| Rechnungstyp | Kennzeichen |
|--------------|-------------|
| Eingangsrechnung | S (Soll) |
| Ausgangsrechnung | H (Haben) |

### BU-Schlüssel (Steuerkennzeichen)
| Steuersatz | Eingangsrechnung | Ausgangsrechnung |
|------------|------------------|------------------|
| 0% | 0 | 0 |
| 7% | 2 | 12 |
| 16% | 55 | 56 |
| 19% | 1 | 11 |

### Datumsformat
**DDMMYYYY** (z.B. `15012024` für 15.01.2024)

### Betragsformat
- Ohne Tausendertrennzeichen
- Komma als Dezimaltrennzeichen
- 2 Dezimalstellen
- Beispiel: `1234,56`

## Kostenstellen / Kostenträger

Das System unterstützt DATEV-konforme Kostenstellen- und Kostenträger-Verarbeitung:

- **KOST1 - Kostenstelle**: Max. 8 Zeichen
- **KOST2 - Kostenträger**: Max. 8 Zeichen

Diese können pro Rechnungsposition individuell gesetzt werden.

## API-Usage

### Export erstellen

```typescript
POST /api/exports
{
  "format": "DATEV",
  "invoiceIds": ["inv-123", "inv-124"],
  "datevOptions": {
    "consultantNumber": "1234567",
    "clientNumber": "00123",
    "fiscalYearStart": "0101",
    "defaultExpenseAccount": "6000",
    "defaultRevenueAccount": "8000",
    "defaultContraAccount": "1200",
    "batchName": "Rechnungen Januar 2024"
  }
}
```

### Optionen

| Option | Beschreibung | Format |
|--------|--------------|--------|
| `consultantNumber` | DATEV Beraternummer | 5-7 Ziffern |
| `clientNumber` | DATEV Mandantennummer | 1-5 Ziffern |
| `fiscalYearStart` | Wirtschaftsjahr Beginn | DDMM (z.B. "0101") |
| `defaultExpenseAccount` | Standard-Aufwandkonto | 4 Ziffern |
| `defaultRevenueAccount` | Standard-Ertragskonto | 4 Ziffern |
| `defaultContraAccount` | Standard-Gegenkonto | 4 Ziffern |
| `batchName` | Bezeichnung des Buchungsstapels | Freitext |

### Export herunterladen

```typescript
GET /api/exports/[exportId]/download
```

## Dateinamen

Standard-Format:
```
EXTF_[Beraternummer]_[Mandantennummer]_[YYYYMMDDhhmm].csv
```

Beispiel:
```
EXTF_1234567_00123_202401151430.csv
```

## Kontenrahmen

Der Export ist optimiert für **SKR04** (Kontenrahmen für die Bundesrepublik Deutschland), unterstützt aber auch:
- SKR03 (mittelstandorientierter Kontenrahmen)
- IKR (Industriekontenrahmen)

Das Rechnungswesen wird im Header als "2" (SKR04) gekennzeichnet.

## Import in DATEV

### DATEV Unternehmen Online
1. Buchhaltung → Belege → Buchungsdaten importieren
2. Format: "Buchungsstapel (CSV)"
3. Zeichensatz: UTF-8
4. Trennzeichen: Semikolon

### DATEV Rechnungswesen
1. Import → Buchungsdaten
2. Dateityp: CSV Buchungsstapel
3. Kodierung: UTF-8

## Fehlerbehebung

### Umlaute werden nicht korrekt angezeigt
→ Stelle sicher, dass der Import als UTF-8 erfolgt

### Beträge werden falsch interpretiert
→ Prüfe, ob das Dezimalkomma korrekt gesetzt ist (Komma statt Punkt)

### Steuerschlüssel nicht gefunden
→ Überprüfe die Steuersätze in den Rechnungspositionen

## Export-Dialog (UI)

Der Export kann über die Web-Oberfläche unter `/exports` durchgeführt werden:

1. **Rechnungen auswählen** - Checkboxen in der Rechnungsliste
2. **"Neuer Export"** klicken - öffnet den Export-Dialog
3. **Format wählen** - CSV (Standard) oder DATEV Buchungsstapel
4. **DATEV-Optionen konfigurieren** (nur bei DATEV-Format):
   - Beraternummer / Mandantennummer
   - WJ-Beginn
   - Sachkonten (Aufwand / Ertrag / Gegenkonto)
   - Buchungsstapel-Bezeichnung
5. **Exportieren** - Datei wird generiert und kann heruntergeladen werden

### Komponenten

- `src/components/exports/export-dialog.tsx` - Export-Dialog mit DATEV-Konfiguration
- `src/components/exports/export-list.tsx` - Liste bisheriger Exporte
- `src/components/exports/invoice-selector.tsx` - Rechnungsauswahl
- `app/(app)/exports/page.tsx` - Export-Seite

## Testen

Die Tests für den DATEV Export befinden sich in:
```
tests/unit/datev.test.ts
```

Ausführen:
```bash
bun test tests/unit/datev.test.ts
```

## Weiterführende Links

- [DATEV Formatdokumentation](https://www.datev.de/web/de/datev-shop/schnittstellen-und-formate/)
- [DATEV Buchungsstapel CSV](https://developer.datev.de/)
