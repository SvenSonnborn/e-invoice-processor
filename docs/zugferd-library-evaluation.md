# ZUGFeRD/XRechnung-Generierung: Library-Evaluation

> **Datum:** 2026-02-14
> **Kontext:** E-Rechnung-Projekt (Next.js 16, TypeScript, Bun)
> **Ziel:** Library für die _Generierung_ von ZUGFeRD/XRechnung-konformen Rechnungen evaluieren

---

## Executive Summary

| Library                 | Sprache    | ZUGFeRD 2.3+ | XRechnung 3.0  | TS-Support  | Lizenz     | Downloads/Monat | Empfehlung                        |
| ----------------------- | ---------- | ------------ | -------------- | ----------- | ---------- | --------------- | --------------------------------- |
| **@e-invoice-eu/core**  | TypeScript | ✅           | ✅             | ✅ nativ    | WTFPL      | ~9.000          | ⭐ **Empfohlen**                  |
| **node-zugferd**        | TypeScript | ✅           | ❌ (nur CII)   | ✅ nativ    | MIT        | ~4.900          | Gute Alternative                  |
| **factur-x-kit**        | TypeScript | ✅ (2.4)     | ❌ nicht impl. | ✅ nativ    | MIT        | ~300            | Vielversprechend, noch jung       |
| **zugferd-generator**   | TypeScript | ✅           | ❌ unklar      | ✅          | MIT        | ~1.700          | Einfach, aber limitiert           |
| **Mustang Project**     | Java       | ✅           | ✅             | ❌ (Java)   | Apache 2.0 | N/A (Maven)     | Referenzimpl., Microservice nötig |
| **factur-x** (Python)   | Python     | ✅ (2.2+)    | ⚠️ teilweise   | ❌ (Python) | BSD        | N/A (PyPI)      | Matur, aber Microservice nötig    |
| **drafthorse** (Python) | Python     | ✅ (2.3)     | ❌             | ❌ (Python) | Apache 2.0 | N/A (PyPI)      | Gute Low-Level-Lib                |

---

## Detaillierte Evaluation

### 1. @e-invoice-eu/core ⭐ Empfohlen

**Repository:** https://github.com/gflohr/e-invoice-eu
**Version:** 2.3.0 (Feb 2026) | **Lizenz:** WTFPL | **Stars:** 150 | **Downloads:** ~9.000/Monat

**Unterstützte Formate:**

- ✅ Factur-X / ZUGFeRD (Minimum, BasicWL, Basic, Extended)
- ✅ UBL (XRechnung-Basis)
- ✅ CII (Cross-Industry Invoice)
- ✅ XRechnung / X-Rechnung
- ✅ EN16931-konform

**Stärken:**

- Nativer TypeScript-Support mit vollständigen Type-Definitions
- Flexibel: CLI, REST-API, und Library-Modus
- Generiert sowohl CII-XML (ZUGFeRD) als auch UBL-XML (XRechnung)
- PDF/A-3 mit eingebettetem XML
- Input: JSON oder Spreadsheet-Daten
- Aktive Wartung (9 Contributors, 20 Open Issues, regelmäßige Releases)
- Nutzt intern `xmlbuilder2` – gut getestete XML-Generierung
- Monorepo-Struktur mit separatem CLI-Package

**Schwächen:**

- WTFPL-Lizenz ist ungewöhnlich (aber kommerziell unproblematisch)
- PDF/A-Compliance kann bei bestimmten Quell-PDFs problematisch sein (GhostScript/LibreOffice als Postprocessing empfohlen)
- Relativ junges Projekt (v1.0 Jan 2025)

**Dependencies:** xmlbuilder2, ajv, pdf-lib, zod-kompatible Validierung

**Passt zu unserem Stack:** ✅ Exzellent – TypeScript, Zod-ähnliche Patterns, Next.js-kompatibel

---

### 2. node-zugferd

**Repository:** https://github.com/jslno/node-zugferd
**Version:** 0.0.8 (März 2025) | **Lizenz:** MIT | **Stars:** 54 | **Downloads:** ~4.900/Monat

**Unterstützte Profile (CII):**

- ✅ MINIMUM, BASIC WL, BASIC, EN 16931 (COMFORT), EXTENDED

**Stärken:**

- 100% TypeScript
- Saubere API mit Zod-Validierung
- Gute DX: `zugferd({ profile: BASIC }).create(data).toXML()`
- PDF/A-3b Embedding
- XSD-Validierung (optional)
- MIT-Lizenz

**Schwächen:**

- ❌ Kein XRechnung/UBL-Support (nur CII-Syntax)
- Noch Beta (v0.0.x) – API kann sich ändern
- Letzte Aktivität März 2025 (10 Monate ohne Update)
- Keine offizielle XRechnung 3.0 Unterstützung

**Passt zu unserem Stack:** ✅ Gut – TypeScript, Zod, pdf-lib

---

### 3. factur-x-kit

**Repository:** https://github.com/NikolaiMe/factur-x-kit
**Version:** 0.3.1 (Dez 2025) | **Lizenz:** MIT | **Stars:** 1 | **Downloads:** ~300/Monat

**Unterstützte Profile:**

- ✅ MINIMUM, BASIC WL, BASIC, COMFORT (EN 16931)
- ⚠️ EXTENDED: Placeholder, nicht funktional
- ❌ X-RECHNUNG: Nicht implementiert

**Stärken:**

- TypeScript-nativ
- Automatische Berechnung (Summen, Steuern, Positionen)
- Lesen UND Schreiben von Hybrid-Rechnungen
- PDF/A-3 Konvertierung
- Factur-X 1.08 / ZUGFeRD 2.4
- Lokalisierung (DE, EN, FR)
- MIT-Lizenz

**Schwächen:**

- ❌ XRechnung nicht implementiert
- Sehr neues Projekt (seit Aug 2025)
- Nur 1 Star – geringe Community
- Extended-Profil noch nicht funktional
- PDF-Konvertierung nicht für alle PDFs zuverlässig

**Passt zu unserem Stack:** ✅ Gut – TypeScript, Zod, pdf-lib

---

### 4. zugferd-generator

**Repository:** https://github.com/BenediktCleff/zugferd-generator
**Version:** 1.2.1 (Jul 2025) | **Lizenz:** MIT | **Stars:** k.A. | **Downloads:** ~1.700/Monat

**Stärken:**

- Lightweight, minimale Dependencies (nur pdf-lib)
- TypeScript-Support
- Einfache API
- MIT-Lizenz

**Schwächen:**

- Wenig Dokumentation über unterstützte Profile/Versionen
- Keine Informationen über XRechnung-Support
- Relativ neues Projekt (seit Dez 2024)
- Weniger Features als Alternativen

**Passt zu unserem Stack:** ✅ Akzeptabel – einfach, aber möglicherweise zu limitiert

---

### 5. Mustang Project (Java)

**Repository:** https://github.com/zugferd/mustangproject
**Version:** 2.22.0 (Feb 2026) | **Lizenz:** Apache 2.0 | **Stars:** 390

**Unterstützte Formate:**

- ✅ ZUGFeRD 2.3 / Factur-X
- ✅ XRechnung (CII + UBL)
- ✅ EN 16931
- ✅ Validierung

**Stärken:**

- **Referenzimplementierung** der ZUGFeRD-Community
- Umfassendste Unterstützung aller Standards
- 87 Contributors, 66 Releases, 2.383 Commits
- CLI-Tool für Validierung
- Apache 2.0 Lizenz
- Aktive Wartung

**Schwächen:**

- ❌ Java – erfordert JVM oder Microservice-Architektur
- Integration in Next.js nur über REST-API möglich
- Zusätzliche Infrastruktur (Docker, JVM) nötig
- Erhöhte Latenz durch Service-Kommunikation

**Integration:** Müsste als Docker-Container / Microservice deployed werden

---

### 6. factur-x (Python)

**Repository:** https://github.com/akretion/factur-x
**Version:** 3.15 (Dez 2025) | **Lizenz:** BSD | **Maintainer:** Akretion (Alexis de Lattre)

**Unterstützte Formate:**

- ✅ Factur-X / ZUGFeRD 2.2+
- ✅ EN 16931
- ⚠️ XRechnung: Teilweise (Dateinamen-Flexibilität ab v3.13)
- ✅ Order-X

**Stärken:**

- Etabliert und matur
- Gute Dokumentation
- BSD-Lizenz
- Flask-Webservice möglich
- XSD-Validierung
- PDF/A-3 Compliance

**Schwächen:**

- ❌ Python – erfordert Microservice
- XRechnung-Support eingeschränkt (kein UBL-Output)
- Zusätzliche Infrastruktur nötig

---

### 7. drafthorse (Python)

**Repository:** https://github.com/pretix/python-drafthorse
**Version:** 2025.2.0 (Sep 2025) | **Lizenz:** Apache 2.0 | **Maintainer:** Raphael Michel (pretix)

**Stärken:**

- ZUGFeRD 2.3 vollständig unterstützt
- Low-Level-Zugang zu allen Feldern
- XSD-Validierung
- Von pretix (großes Ticketing-Unternehmen) gewartet

**Schwächen:**

- ❌ Python – erfordert Microservice
- Kein XRechnung/UBL-Output
- Low-Level API = mehr Boilerplate

---

## Vergleichsmatrix

| Kriterium          | @e-invoice-eu | node-zugferd | factur-x-kit | Mustang     | factur-x (Py) |
| ------------------ | ------------- | ------------ | ------------ | ----------- | ------------- |
| XRechnung 3.0      | ✅            | ❌           | ❌           | ✅          | ⚠️            |
| ZUGFeRD 2.3+       | ✅            | ✅           | ✅ (2.4)     | ✅          | ✅            |
| TypeScript nativ   | ✅            | ✅           | ✅           | ❌          | ❌            |
| Aktiv gewartet     | ✅            | ⚠️           | ✅           | ✅          | ✅            |
| Dokumentation      | ✅ gut        | ✅ gut       | ⚠️ basic     | ✅ sehr gut | ✅ gut        |
| Lizenz kommerziell | ✅ WTFPL      | ✅ MIT       | ✅ MIT       | ✅ Apache   | ✅ BSD        |
| CII-Output         | ✅            | ✅           | ✅           | ✅          | ✅            |
| UBL-Output         | ✅            | ❌           | ❌           | ✅          | ❌            |
| PDF/A-3 Embedding  | ✅            | ✅           | ✅           | ✅          | ✅            |
| Keine Extra-Infra  | ✅            | ✅           | ✅           | ❌ JVM      | ❌ Python     |
| Community          | 150⭐         | 54⭐         | 1⭐          | 390⭐       | ~200⭐        |

---

## Empfehlung

### Primär: `@e-invoice-eu/core`

**Begründung:**

1. **Einzige JS/TS-Library mit XRechnung-Support** – Generiert sowohl CII (ZUGFeRD) als auch UBL (XRechnung)
2. **Nativer TypeScript** – Passt perfekt zu unserem Stack (Next.js, TypeScript, Zod)
3. **Keine zusätzliche Infrastruktur** – Läuft direkt in Node.js, kein Microservice nötig
4. **Aktiv gewartet** – Regelmäßige Releases, aktive Community
5. **Flexibel** – Library, CLI und REST-API Modi verfügbar
6. **EN16931-konform** – Vollständige Unterstützung des europäischen Standards

### Fallback: `node-zugferd` + manuelle UBL-Generierung

Falls XRechnung (UBL) zunächst nicht benötigt wird, ist `node-zugferd` eine schlankere Alternative für reine ZUGFeRD/CII-Generierung. Die API ist besonders elegant und nutzt Zod für Validierung.

### Nicht empfohlen für unser Projekt:

- **Mustang Project** – Exzellent als Referenz, aber Java-Dependency ist für unser Next.js-Projekt overengineered
- **Python-Libraries** – Gleiches Problem wie Mustang: Microservice-Overhead
- **factur-x-kit** – Vielversprechend, aber noch zu jung und kein XRechnung-Support
- **Manuelle XML-Generierung (xmlbuilder2)** – Zu viel Aufwand, fehleranfällig, Standard-Compliance schwer sicherzustellen

---

## Nächste Schritte

1. **PoC mit `@e-invoice-eu/core`** – Einfache ZUGFeRD-Rechnung generieren
2. **XRechnung-Output testen** – UBL-XML-Generierung verifizieren
3. **Integration planen** – In bestehende Invoice-Pipeline einbauen (neben Parser)
4. **Validierung** – Generierte XML gegen offizielle Validatoren prüfen (KoSIT Validator)
