/**
 * DATEV CSV Exporter
 * Exports invoices in DATEV Standard Buchungsstapel CSV format
 *
 * Format specification based on DATEV Dokumentation:
 * - UTF-8 encoding with BOM
 * - Semicolon as delimiter
 * - Header rows with metadata
 * - Standard field mapping for accounting
 */

import type { Invoice, InvoiceLineItem } from "@prisma/client";

// DATEV Buchungsstapel Header Felder (CSV Spalten)
const DATEV_COLUMNS = [
  "Umsatz (ohne Soll/Haben-Kennzeichen)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
  "Postensperre",
  "Diverse Adressnummer",
  "Geschäftspartnername",
  "Sachverhalt",
  "Zinssperre",
  "Beleglink",
  "Beleginfo - Art 1",
  "Beleginfo - Inhalt 1",
  "Beleginfo - Art 2",
  "Beleginfo - Inhalt 2",
  "Beleginfo - Art 3",
  "Beleginfo - Inhalt 3",
  "Beleginfo - Art 4",
  "Beleginfo - Inhalt 4",
  "Beleginfo - Art 5",
  "Beleginfo - Inhalt 5",
  "Beleginfo - Art 6",
  "Beleginfo - Inhalt 6",
  "Beleginfo - Art 7",
  "Beleginfo - Inhalt 7",
  "Beleginfo - Art 8",
  "Beleginfo - Inhalt 8",
  "KOST1 - Kostenstelle",
  "KOST2 - Kostenträger",
  "Kost-Menge",
  "EU-Land",
  "EU-Steuernummer",
  "EU-Betrag",
  "Abw. Versteuerungsart",
  "Sachverhalt L+L",
  "Funktionsergänzung L+L",
  "BU 49 Hauptfunktionstyp",
  "BU 49 Hauptfunktionsnummer",
  "BU 49 Funktionsergänzung",
  "Zusatzinformation - Art 1",
  "Zusatzinformation - Inhalt 1",
  "Zusatzinformation - Art 2",
  "Zusatzinformation - Inhalt 2",
  "Zusatzinformation - Art 3",
  "Zusatzinformation - Inhalt 3",
  "Zusatzinformation - Art 4",
  "Zusatzinformation - Inhalt 4",
  "Zusatzinformation - Art 5",
  "Zusatzinformation - Inhalt 5",
  "Zusatzinformation - Art 6",
  "Zusatzinformation - Inhalt 6",
  "Zusatzinformation - Art 7",
  "Zusatzinformation - Inhalt 7",
  "Zusatzinformation - Art 8",
  "Zusatzinformation - Inhalt 8",
  "Zusatzinformation - Art 9",
  "Zusatzinformation - Inhalt 9",
  "Zusatzinformation - Art 10",
  "Zusatzinformation - Inhalt 10",
  "Zusatzinformation - Art 11",
  "Zusatzinformation - Inhalt 11",
  "Zusatzinformation - Art 12",
  "Zusatzinformation - Inhalt 12",
  "Zusatzinformation - Art 13",
  "Zusatzinformation - Inhalt 13",
  "Zusatzinformation - Art 14",
  "Zusatzinformation - Inhalt 14",
  "Zusatzinformation - Art 15",
  "Zusatzinformation - Inhalt 15",
  "Zusatzinformation - Art 16",
  "Zusatzinformation - Inhalt 16",
  "Zusatzinformation - Art 17",
  "Zusatzinformation - Inhalt 17",
  "Zusatzinformation - Art 18",
  "Zusatzinformation - Inhalt 18",
  "Zusatzinformation - Art 19",
  "Zusatzinformation - Inhalt 19",
  "Zusatzinformation - Art 20",
  "Zusatzinformation - Inhalt 20",
  "Stück",
  "Gewicht",
  "Zahlweise",
  "Forderungsart",
  "Veranlagungsjahr",
  "Zugeordnete Fälligkeit",
  "Skontotyp",
  "Auftragsnummer",
  "Buchungstyp (Anzahlungen)",
  "USt-Schlüssel (Anzahlungen)",
  "EU-Mitgliedstaat (Anzahlungen)",
  "Sachverhalt L+L (Anzahlungen)",
  "EU-Steuernummer (Anzahlungen)",
  "Zusatzinformationen (Anzahlungen)",
  "Konto (Anzahlungen)",
  "Gegenkonto (Anzahlungen)",
  "BU-Schlüssel (Anzahlungen)",
  "Fälligkeit (Anzahlungen)",
  "Generalumkehr (GU)",
  "Steuersatz",
  "Belegdatum (Steuerperiode)",
] as const;

export interface DatevExportOptions {
  /** Beraternummer (5-7 Stellen) */
  consultantNumber?: string;
  /** Mandantennummer (1-5 Stellen) */
  clientNumber?: string;
  /** Wirtschaftsjahr Beginn (DDMM) */
  fiscalYearStart?: string;
  /** Sachkonto für Rechnungseingang (Eingangsrechnungen) */
  defaultExpenseAccount?: string;
  /** Sachkonto für Rechnungsausgang (Ausgangsrechnungen) */
  defaultRevenueAccount?: string;
  /** Standard-Gegenkonto (z.B. 1200 für Bank) */
  defaultContraAccount?: string;
  /** Buchungsstapel-Bezeichnung */
  batchName?: string;
  /** Diktat-/Abrechnungsnummer (max. 4 Stellen) */
  dictationNumber?: string;
  /** Buchungstyp (1=Finanzbuchführung, 2=Jahresabschluss) */
  bookingType?: string;
  /** Rechnungswesen (0=IKR, 1=SKR03, 2=SKR04) */
  accountingSystem?: string;
}

export interface DatevExportLineItem extends InvoiceLineItem {
  invoice: Invoice & {
    supplierName?: string | null;
    customerName?: string | null;
  };
  /** Sachkonto für diese Position */
  accountNumber?: string;
  /** Gegenkonto für diese Position */
  contraAccountNumber?: string;
  /** Kostenstelle */
  costCenter?: string;
  /** Kostenträger */
  costObject?: string;
  /** BU-Schlüssel (Steuercode) */
  taxKey?: string;
  /** Individueller Buchungstext */
  bookingText?: string;
}

/**
 * Formatiert ein Datum für DATEV (DDMMYYYY)
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}${month}${year}`;
}

/**
 * Formatiert einen Betrag für DATEV (ohne Dezimaltrennzeichen, 2 Dezimalstellen)
 * Beispiel: 1234.56 -> 1234,56
 */
function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "0,00";
  return amount.toFixed(2).replace(".", ",");
}

/**
 * Formatiert einen Betrag für DATEV (mit Soll/Haben-Kennzeichen)
 * Soll = S, Haben = H
 */
function formatAmountWithSign(
  amount: number | null | undefined,
  isCredit: boolean = false
): { amount: string; sign: string } {
  if (amount === null || amount === undefined) {
    return { amount: "0,00", sign: isCredit ? "H" : "S" };
  }
  const absAmount = Math.abs(amount);
  return {
    amount: formatAmount(absAmount),
    sign: isCredit ? "H" : "S",
  };
}

/**
 * Bestimmt den BU-Schlüssel basierend auf dem Steuersatz
 * SKR04 Steuercodes (üblichste):
 * - 0%: 0 oder 94 (steuerfrei)
 * - 7%: 2 (Vorsteuer 7%), 12 (USt 7%)
 * - 19%: 1 (Vorsteuer 19%), 11 (USt 19%)
 * - 16%: 55 (Vorsteuer 16%), 56 (USt 16%)
 */
function getTaxKey(taxRate: number | null | undefined, isInputTax: boolean = true): string {
  if (taxRate === null || taxRate === undefined) return "0";
  
  const rate = Math.round(taxRate * 100) / 100;
  
  if (rate === 0) return "0";
  if (rate === 7) return isInputTax ? "2" : "12";
  if (rate === 19) return isInputTax ? "1" : "11";
  if (rate === 16) return isInputTax ? "55" : "56";
  
  // Fallback: 19%
  return isInputTax ? "1" : "11";
}

/**
 * Escaped einen Feldwert für DATEV CSV.
 * - Zeilenumbrüche werden durch Leerzeichen ersetzt
 * - Felder mit Semikolon oder Anführungszeichen werden in doppelte Anführungszeichen eingeschlossen
 * - Vorhandene Anführungszeichen werden verdoppelt (CSV-Standard)
 */
function escapeField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  let cleaned = String(value).replace(/[\r\n]+/g, " ").trim();
  if (cleaned.includes(";") || cleaned.includes('"')) {
    cleaned = '"' + cleaned.replace(/"/g, '""') + '"';
  }
  return cleaned;
}

/**
 * Erzeugt die DATEV-Header-Zeilen (Metadaten)
 */
function generateDatevHeader(options: DatevExportOptions): string[] {
  const {
    consultantNumber = "0000000",
    clientNumber = "00000",
    fiscalYearStart = "0101",
    batchName = "Rechnungsexport",
    dictationNumber = "0",
    bookingType = "1",
    accountingSystem = "2", // SKR04 Standard
  } = options;

  // Format: EXTFD;Beraternummer;Mandantennummer;WJ-Beginn;Buchungsstapel;Bezeichnung;
  //         Diktatnr;Buchungstyp;Rechnungswesen;...
  const headerLine1 = [
    "EXTFD",
    consultantNumber.padStart(7, "0"),
    clientNumber.padStart(5, "0"),
    fiscalYearStart,
    formatDate(new Date()),
    batchName,
    dictationNumber,
    bookingType,
    accountingSystem,
    "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  ].join(";");

  // Spaltenüberschriften als zweite Zeile
  const headerLine2 = DATEV_COLUMNS.join(";");

  return [headerLine1, headerLine2];
}

/**
 * Wandelt einen InvoiceLineItem in eine DATEV-Buchungszeile um
 */
function lineItemToDatevRow(
  item: DatevExportLineItem,
  options: DatevExportOptions,
  lineIndex: number
): string {
  const {
    defaultExpenseAccount = "4900",
    defaultRevenueAccount = "8400",
    defaultContraAccount = "1200",
  } = options;

  const invoice = item.invoice;
  const isOutgoingInvoice = invoice.customerName ? true : false;
  
  // Bestimme Konten
  const account = item.accountNumber ?? (isOutgoingInvoice ? defaultRevenueAccount : defaultExpenseAccount);
  const contraAccount = item.contraAccountNumber ?? defaultContraAccount;
  
  // Betrag und Soll/Haben
  const amount = Number(item.grossAmount ?? item.netAmount ?? 0);
  // Eingangsrechnungen = Soll (Aufwand), Ausgangsrechnungen = Haben (Ertrag)
  const { amount: formattedAmount, sign } = formatAmountWithSign(amount, isOutgoingInvoice);
  
  // Steuerschlüssel
  const taxKey = item.taxKey ?? getTaxKey(Number(item.taxRate), !isOutgoingInvoice);
  
  // Buchungstext
  const bookingText = item.bookingText ?? 
    `${invoice.number ?? `RG-${lineIndex}`} ${item.description ?? ""}`.substring(0, 60);
  
  // Belegdatum
  const documentDate = formatDate(invoice.issueDate);
  
  // Belegnummer
  const documentNumber = invoice.number ?? String(lineIndex + 1);

  // Erstelle die Datenzeile
  const row: Record<string, string> = {
    "Umsatz (ohne Soll/Haben-Kennzeichen)": formattedAmount,
    "Soll/Haben-Kennzeichen": sign,
    "WKZ Umsatz": invoice.currency ?? "EUR",
    "Kurs": "",
    "Basis-Umsatz": "",
    "WKZ Basis-Umsatz": "",
    "Konto": account,
    "Gegenkonto": contraAccount,
    "BU-Schlüssel": taxKey,
    "Belegdatum": documentDate,
    "Belegfeld 1": documentNumber.substring(0, 36),
    "Belegfeld 2": "",
    "Skonto": "",
    "Buchungstext": escapeField(bookingText).substring(0, 60),
    "Postensperre": "",
    "Diverse Adressnummer": "",
    "Geschäftspartnername": escapeField(invoice.supplierName ?? invoice.customerName ?? "").substring(0, 50),
    "Sachverhalt": "",
    "Zinssperre": "",
    "Beleglink": "",
    "Beleginfo - Art 1": "",
    "Beleginfo - Inhalt 1": "",
    "Beleginfo - Art 2": "",
    "Beleginfo - Inhalt 2": "",
    "Beleginfo - Art 3": "",
    "Beleginfo - Inhalt 3": "",
    "Beleginfo - Art 4": "",
    "Beleginfo - Inhalt 4": "",
    "Beleginfo - Art 5": "",
    "Beleginfo - Inhalt 5": "",
    "Beleginfo - Art 6": "",
    "Beleginfo - Inhalt 6": "",
    "Beleginfo - Art 7": "",
    "Beleginfo - Inhalt 7": "",
    "Beleginfo - Art 8": "",
    "Beleginfo - Inhalt 8": "",
    "KOST1 - Kostenstelle": escapeField(item.costCenter ?? "").substring(0, 8),
    "KOST2 - Kostenträger": escapeField(item.costObject ?? "").substring(0, 8),
    "Kost-Menge": item.quantity ? String(item.quantity) : "",
    "EU-Land": "",
    "EU-Steuernummer": "",
    "EU-Betrag": "",
    "Abw. Versteuerungsart": "",
    "Sachverhalt L+L": "",
    "Funktionsergänzung L+L": "",
    "BU 49 Hauptfunktionstyp": "",
    "BU 49 Hauptfunktionsnummer": "",
    "BU 49 Funktionsergänzung": "",
    "Zusatzinformation - Art 1": "",
    "Zusatzinformation - Inhalt 1": "",
    "Zusatzinformation - Art 2": "",
    "Zusatzinformation - Inhalt 2": "",
    "Zusatzinformation - Art 3": "",
    "Zusatzinformation - Inhalt 3": "",
    "Zusatzinformation - Art 4": "",
    "Zusatzinformation - Inhalt 4": "",
    "Zusatzinformation - Art 5": "",
    "Zusatzinformation - Inhalt 5": "",
    "Zusatzinformation - Art 6": "",
    "Zusatzinformation - Inhalt 6": "",
    "Zusatzinformation - Art 7": "",
    "Zusatzinformation - Inhalt 7": "",
    "Zusatzinformation - Art 8": "",
    "Zusatzinformation - Inhalt 8": "",
    "Zusatzinformation - Art 9": "",
    "Zusatzinformation - Inhalt 9": "",
    "Zusatzinformation - Art 10": "",
    "Zusatzinformation - Inhalt 10": "",
    "Zusatzinformation - Art 11": "",
    "Zusatzinformation - Inhalt 11": "",
    "Zusatzinformation - Art 12": "",
    "Zusatzinformation - Inhalt 12": "",
    "Zusatzinformation - Art 13": "",
    "Zusatzinformation - Inhalt 13": "",
    "Zusatzinformation - Art 14": "",
    "Zusatzinformation - Inhalt 14": "",
    "Zusatzinformation - Art 15": "",
    "Zusatzinformation - Inhalt 15": "",
    "Zusatzinformation - Art 16": "",
    "Zusatzinformation - Inhalt 16": "",
    "Zusatzinformation - Art 17": "",
    "Zusatzinformation - Inhalt 17": "",
    "Zusatzinformation - Art 18": "",
    "Zusatzinformation - Inhalt 18": "",
    "Zusatzinformation - Art 19": "",
    "Zusatzinformation - Inhalt 19": "",
    "Zusatzinformation - Art 20": "",
    "Zusatzinformation - Inhalt 20": "",
    "Stück": "",
    "Gewicht": "",
    "Zahlweise": "",
    "Forderungsart": "",
    "Veranlagungsjahr": "",
    "Zugeordnete Fälligkeit": formatDate(invoice.dueDate),
    "Skontotyp": "",
    "Auftragsnummer": "",
    "Buchungstyp (Anzahlungen)": "",
    "USt-Schlüssel (Anzahlungen)": "",
    "EU-Mitgliedstaat (Anzahlungen)": "",
    "Sachverhalt L+L (Anzahlungen)": "",
    "EU-Steuernummer (Anzahlungen)": "",
    "Zusatzinformationen (Anzahlungen)": "",
    "Konto (Anzahlungen)": "",
    "Gegenkonto (Anzahlungen)": "",
    "BU-Schlüssel (Anzahlungen)": "",
    "Fälligkeit (Anzahlungen)": "",
    "Generalumkehr (GU)": "",
    "Steuersatz": item.taxRate ? String(item.taxRate) : "",
    "Belegdatum (Steuerperiode)": "",
  };

  // Baue die Zeile in der richtigen Reihenfolge
  return DATEV_COLUMNS.map((col) => row[col] ?? "").join(";");
}

/**
 * Exportiert Rechnungen im DATEV CSV Format
 *
 * @param items - Rechnungspositionen mit Rechnungsdaten
 * @param options - DATEV Export Optionen
 * @returns CSV-String im DATEV Format mit UTF-8 BOM
 */
export function invoicesToDatevCsv(
  items: DatevExportLineItem[],
  options: DatevExportOptions = {}
): string {
  // Header-Zeilen
  const headerLines = generateDatevHeader(options);
  
  // Datenzeilen
  const dataLines = items.map((item, index) => lineItemToDatevRow(item, options, index));
  
  // Kombiniere alle Zeilen
  const csvContent = [...headerLines, ...dataLines].join("\r\n");
  
  // Füge UTF-8 BOM hinzu (wichtig für DATEV-Kompatibilität)
  const BOM = "\uFEFF";
  
  return BOM + csvContent;
}

/** Invoice type used by invoice-level DATEV export functions */
type DatevInvoice = Invoice & {
  supplierName?: string | null;
  customerName?: string | null;
  lineItems?: InvoiceLineItem[];
};

/**
 * Wandelt eine Rechnung (aggregiert auf Rechnungsebene) in eine DATEV-Buchungszeile um.
 * Interne Hilfsfunktion, die nur die Datenzeile ohne Header/BOM erzeugt.
 */
function invoiceToDatevRow(
  invoice: DatevInvoice,
  options: DatevExportOptions,
  rowIndex: number
): string {
  const {
    defaultExpenseAccount = "4900",
    defaultRevenueAccount = "8400",
    defaultContraAccount = "1200",
  } = options;

  const isOutgoingInvoice = invoice.customerName ? true : false;
  const account = isOutgoingInvoice ? defaultRevenueAccount : defaultExpenseAccount;
  const contraAccount = defaultContraAccount;
  
  const amount = Number(invoice.grossAmount ?? invoice.netAmount ?? 0);
  const { amount: formattedAmount, sign } = formatAmountWithSign(amount, isOutgoingInvoice);
  
  // Steuerschlüssel aus den LineItems ableiten oder Standard verwenden
  let taxKey = "0";
  if (invoice.lineItems && invoice.lineItems.length > 0) {
    const firstItem = invoice.lineItems[0];
    taxKey = getTaxKey(Number(firstItem.taxRate), !isOutgoingInvoice);
  }
  
  const documentDate = formatDate(invoice.issueDate);
  const documentNumber = invoice.number ?? String(rowIndex + 1);
  const bookingText = escapeField(
    `${invoice.number ?? "Rechnung"} ${isOutgoingInvoice ? "Ausgangsrechnung" : "Eingangsrechnung"}`
  ).substring(0, 60);
  const partnerName = escapeField(invoice.supplierName ?? invoice.customerName ?? "").substring(0, 50);

  const row: Record<string, string> = {
    "Umsatz (ohne Soll/Haben-Kennzeichen)": formattedAmount,
    "Soll/Haben-Kennzeichen": sign,
    "WKZ Umsatz": invoice.currency ?? "EUR",
    "Kurs": "",
    "Basis-Umsatz": "",
    "WKZ Basis-Umsatz": "",
    "Konto": account,
    "Gegenkonto": contraAccount,
    "BU-Schlüssel": taxKey,
    "Belegdatum": documentDate,
    "Belegfeld 1": documentNumber.substring(0, 36),
    "Belegfeld 2": "",
    "Skonto": "",
    "Buchungstext": bookingText,
    "Postensperre": "",
    "Diverse Adressnummer": "",
    "Geschäftspartnername": partnerName,
    "Sachverhalt": "",
    "Zinssperre": "",
    "Beleglink": "",
    "Beleginfo - Art 1": "",
    "Beleginfo - Inhalt 1": "",
    "Beleginfo - Art 2": "",
    "Beleginfo - Inhalt 2": "",
    "Beleginfo - Art 3": "",
    "Beleginfo - Inhalt 3": "",
    "Beleginfo - Art 4": "",
    "Beleginfo - Inhalt 4": "",
    "Beleginfo - Art 5": "",
    "Beleginfo - Inhalt 5": "",
    "Beleginfo - Art 6": "",
    "Beleginfo - Inhalt 6": "",
    "Beleginfo - Art 7": "",
    "Beleginfo - Inhalt 7": "",
    "Beleginfo - Art 8": "",
    "Beleginfo - Inhalt 8": "",
    "KOST1 - Kostenstelle": "",
    "KOST2 - Kostenträger": "",
    "Kost-Menge": "",
    "EU-Land": "",
    "EU-Steuernummer": "",
    "EU-Betrag": "",
    "Abw. Versteuerungsart": "",
    "Sachverhalt L+L": "",
    "Funktionsergänzung L+L": "",
    "BU 49 Hauptfunktionstyp": "",
    "BU 49 Hauptfunktionsnummer": "",
    "BU 49 Funktionsergänzung": "",
    "Zusatzinformation - Art 1": "",
    "Zusatzinformation - Inhalt 1": "",
    "Zusatzinformation - Art 2": "",
    "Zusatzinformation - Inhalt 2": "",
    "Zusatzinformation - Art 3": "",
    "Zusatzinformation - Inhalt 3": "",
    "Zusatzinformation - Art 4": "",
    "Zusatzinformation - Inhalt 4": "",
    "Zusatzinformation - Art 5": "",
    "Zusatzinformation - Inhalt 5": "",
    "Zusatzinformation - Art 6": "",
    "Zusatzinformation - Inhalt 6": "",
    "Zusatzinformation - Art 7": "",
    "Zusatzinformation - Inhalt 7": "",
    "Zusatzinformation - Art 8": "",
    "Zusatzinformation - Inhalt 8": "",
    "Zusatzinformation - Art 9": "",
    "Zusatzinformation - Inhalt 9": "",
    "Zusatzinformation - Art 10": "",
    "Zusatzinformation - Inhalt 10": "",
    "Zusatzinformation - Art 11": "",
    "Zusatzinformation - Inhalt 11": "",
    "Zusatzinformation - Art 12": "",
    "Zusatzinformation - Inhalt 12": "",
    "Zusatzinformation - Art 13": "",
    "Zusatzinformation - Inhalt 13": "",
    "Zusatzinformation - Art 14": "",
    "Zusatzinformation - Inhalt 14": "",
    "Zusatzinformation - Art 15": "",
    "Zusatzinformation - Inhalt 15": "",
    "Zusatzinformation - Art 16": "",
    "Zusatzinformation - Inhalt 16": "",
    "Zusatzinformation - Art 17": "",
    "Zusatzinformation - Inhalt 17": "",
    "Zusatzinformation - Art 18": "",
    "Zusatzinformation - Inhalt 18": "",
    "Zusatzinformation - Art 19": "",
    "Zusatzinformation - Inhalt 19": "",
    "Zusatzinformation - Art 20": "",
    "Zusatzinformation - Inhalt 20": "",
    "Stück": "",
    "Gewicht": "",
    "Zahlweise": "",
    "Forderungsart": "",
    "Veranlagungsjahr": "",
    "Zugeordnete Fälligkeit": formatDate(invoice.dueDate),
    "Skontotyp": "",
    "Auftragsnummer": "",
    "Buchungstyp (Anzahlungen)": "",
    "USt-Schlüssel (Anzahlungen)": "",
    "EU-Mitgliedstaat (Anzahlungen)": "",
    "Sachverhalt L+L (Anzahlungen)": "",
    "EU-Steuernummer (Anzahlungen)": "",
    "Zusatzinformationen (Anzahlungen)": "",
    "Konto (Anzahlungen)": "",
    "Gegenkonto (Anzahlungen)": "",
    "BU-Schlüssel (Anzahlungen)": "",
    "Fälligkeit (Anzahlungen)": "",
    "Generalumkehr (GU)": "",
    "Steuersatz": "",
    "Belegdatum (Steuerperiode)": "",
  };

  return DATEV_COLUMNS.map((col) => row[col] ?? "").join(";");
}

/**
 * Exportiert eine einzelne Rechnung (aggregiert auf Rechnungsebene)
 * Verwendet den Rechnungs-Bruttobetrag statt einzelner Positionen
 */
export function invoiceToDatevCsv(
  invoice: DatevInvoice,
  options: DatevExportOptions = {}
): string {
  const headerLines = generateDatevHeader(options);
  const dataLine = invoiceToDatevRow(invoice, options, 0);
  const csvContent = [...headerLines, dataLine].join("\r\n");
  
  const BOM = "\uFEFF";
  return BOM + csvContent;
}

/**
 * Exportiert mehrere Rechnungen (aggregiert auf Rechnungsebene) in ein einziges DATEV CSV.
 * Erzeugt genau einen Header und eine Datenzeile pro Rechnung.
 *
 * @param invoices - Array von Rechnungen mit optionalen LineItems
 * @param options - DATEV Export Optionen
 * @returns CSV-String im DATEV Format mit UTF-8 BOM
 */
export function invoicesToDatevCsvFromInvoices(
  invoices: DatevInvoice[],
  options: DatevExportOptions = {}
): string {
  const headerLines = generateDatevHeader(options);
  const dataLines = invoices.map((invoice, index) =>
    invoiceToDatevRow(invoice, options, index)
  );
  const csvContent = [...headerLines, ...dataLines].join("\r\n");

  const BOM = "\uFEFF";
  return BOM + csvContent;
}

/**
 * Validiert DATEV Export Optionen
 */
export function validateDatevOptions(options: DatevExportOptions): string[] {
  const errors: string[] = [];
  
  if (options.consultantNumber && !/^\d{5,7}$/.test(options.consultantNumber)) {
    errors.push("Beraternummer muss 5-7 Ziffern haben");
  }
  
  if (options.clientNumber && !/^\d{1,5}$/.test(options.clientNumber)) {
    errors.push("Mandantennummer muss 1-5 Ziffern haben");
  }
  
  if (options.fiscalYearStart && !/^\d{4}$/.test(options.fiscalYearStart)) {
    errors.push("WJ-Beginn muss im Format DDMM sein (z.B. 0101)");
  }
  
  return errors;
}

/**
 * Generiert einen DATEV-kompatiblen Dateinamen
 */
export function generateDatevFilename(
  options: DatevExportOptions = {},
  extension: string = "csv"
): string {
  const {
    consultantNumber = "0000000",
    clientNumber = "00000",
  } = options;
  
  const date = new Date();
  const timestamp = [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join("");
  
  return `EXTF_${consultantNumber}_${clientNumber}_${timestamp}.${extension}`;
}
