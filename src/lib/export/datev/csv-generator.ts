/**
 * DATEV CSV Generator
 */

import type { DatevEntry, DatevExportConfig, DatevHeader } from "./types";
import { DATEV_DELIMITER, DATEV_FORMAT, DATEV_VERSION, DATEV_CATEGORY, DATEV_HEADER_FIELDS, UTF8_BOM, DEFAULT_EXPORT_CONFIG } from "./constants";
import { validateDatevEntry, formatAmount, validateExportConfig } from "./validator";

export function generateHeader(config: Partial<DatevExportConfig> = {}): string {
  const now = new Date();
  const generatedOn = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const fields = [
    config.format === "EXTF" ? "EXTF" : DATEV_FORMAT.DTVF,
    DATEV_VERSION.MAJOR,
    DATEV_CATEGORY.BUCHUNGSSTAPEL,
    DATEV_VERSION.FORMAT_NAME,
    DATEV_VERSION.FORMAT_VERSION,
    generatedOn,
    "",
    config.currency || DEFAULT_EXPORT_CONFIG.currency,
    "",
  ];

  return fields.join(DATEV_DELIMITER.FIELD);
}

/**
 * Generate extended DATEV header
 * Includes additional metadata fields
 */
export function generateExtendedHeader(config: DatevExportConfig): string[] {
  const errors = validateExportConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid export configuration: ${errors.map(e => e.message).join(", ")}`);
  }

  const now = new Date();
  const generatedOn = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const fields = [
    "EXTF",
    DATEV_VERSION.MAJOR.toString(),
    DATEV_CATEGORY.BUCHUNGSSTAPEL.toString(),
    DATEV_VERSION.FORMAT_NAME,
    DATEV_VERSION.FORMAT_VERSION.toString(),
    generatedOn,
    "",
    config.beraterNummer || "",
    config.mandantenNummer || "",
    config.wirtschaftsjahrBeginn || `${now.getFullYear()}0101`,
    config.sachkontenrahmen || "",
    config.bezeichnung || "",
    "",
    "",
    config.buchungsstapelStart?.toString() || "1",
    "",
    config.datumVon || "",
    config.datumBis || "",
    config.bezeichnung || "Buchungsstapel",
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  return fields;
}

export function generateRow(entry: DatevEntry): string {
  const errors = validateDatevEntry(entry);
  if (errors.length > 0) {
    throw new Error(`Invalid DATEV entry: ${errors.map(e => `${e.field}: ${e.message}`).join("; ")}`);
  }

  const fields = [
    formatAmount(entry.umsatzSoll > 0 ? entry.umsatzSoll : entry.umsatzHaben),
    entry.umsatzSoll > 0 ? "S" : "H",
    entry.waehrung || "EUR",
    "",
    "",
    "",
    entry.konto,
    entry.gegenkonto,
    entry.steuerschluessel || "",
    entry.belegdatum || entry.datum,
    entry.belegnummer || "",
    "",
    "",
    entry.buchungstext || "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    entry.kostenstelle || "",
    entry.kostentraeger || "",
    "",
  ];

  return fields.join(DATEV_DELIMITER.FIELD);
}

export function generateCSV(entries: DatevEntry[], config: Partial<DatevExportConfig> = {}): string {
  if (entries.length === 0) {
    throw new Error("At least one entry is required");
  }

  const lines: string[] = [];
  lines.push(generateHeader(config));
  lines.push(DATEV_HEADER_FIELDS.join(DATEV_DELIMITER.FIELD));

  for (const entry of entries) {
    lines.push(generateRow(entry));
  }

  return lines.join(DATEV_DELIMITER.LINE);
}

export function generateCSVWithBOM(entries: DatevEntry[], config: Partial<DatevExportConfig> = {}): string {
  const csv = generateCSV(entries, config);
  return UTF8_BOM + csv;
}

/**
 * Generate extended format CSV
 * Includes additional metadata and uses EXTF format
 */
export function generateExtendedCSV(entries: DatevEntry[], config: DatevExportConfig): string {
  if (entries.length === 0) {
    throw new Error("At least one entry is required to generate DATEV CSV");
  }

  const lines: string[] = [];
  const headerFields = generateExtendedHeader(config);
  lines.push(headerFields.join(DATEV_DELIMITER.FIELD));
  lines.push(DATEV_HEADER_FIELDS.join(DATEV_DELIMITER.FIELD));

  for (const entry of entries) {
    lines.push(generateRow(entry));
  }

  const csv = lines.join(DATEV_DELIMITER.LINE);
  return UTF8_BOM + csv;
}

/**
 * Generate CSV as Buffer (for file download)
 */
export function generateCSVBuffer(entries: DatevEntry[], config: Partial<DatevExportConfig> = {}): Buffer {
  const csv = generateCSVWithBOM(entries, config);
  return Buffer.from(csv, "utf-8");
}

export function generateFilename(prefix = "DATEV_Export"): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `${prefix}_${timestamp}.csv`;
}

/**
 * Generate DATEV-compatible filename with client/advisor info
 */
export function generateStructuredFilename(
  beraterNummer?: string,
  mandantenNummer?: string,
  datumVon?: string,
  datumBis?: string
): string {
  const berater = beraterNummer?.padStart(8, "0") || "00000000";
  const mandant = mandantenNummer?.padStart(5, "0") || "00000";
  const von = datumVon || "";
  const bis = datumBis || "";

  return `EXTF_${berater}_${mandant}_${von}_${bis}.csv`;
}

/**
 * Escape special characters for CSV
 */
export function escapeCsvField(field: string): string {
  if (!field) return "";

  if (
    field.includes(DATEV_DELIMITER.FIELD) ||
    field.includes('"') ||
    field.includes("\n") ||
    field.includes("\r")
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }

  return field;
}

/**
 * Parse a CSV line back into fields
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === DATEV_DELIMITER.FIELD && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);

  return fields;
}
