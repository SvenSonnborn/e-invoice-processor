/**
 * DATEV CSV Generator
 */

import type { DatevEntry } from "./types";
import { DATEV_DELIMITER, DATEV_FORMAT, DATEV_VERSION, DATEV_CATEGORY, DATEV_HEADER_FIELDS, UTF8_BOM } from "./constants";
import { validateDatevEntry, formatAmount } from "./validator";

export function generateHeader(): string {
  const now = new Date();
  const generatedOn = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const fields = [
    DATEV_FORMAT.DTVF,
    DATEV_VERSION.MAJOR,
    DATEV_CATEGORY.BUCHUNGSSTAPEL,
    DATEV_VERSION.FORMAT_NAME,
    DATEV_VERSION.FORMAT_VERSION,
    generatedOn,
    "",
    "EUR",
    "",
  ];

  return fields.join(DATEV_DELIMITER.FIELD);
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

export function generateCSV(entries: DatevEntry[]): string {
  if (entries.length === 0) {
    throw new Error("At least one entry is required");
  }

  const lines: string[] = [];
  lines.push(generateHeader());
  lines.push(DATEV_HEADER_FIELDS.join(DATEV_DELIMITER.FIELD));

  for (const entry of entries) {
    lines.push(generateRow(entry));
  }

  return lines.join(DATEV_DELIMITER.LINE);
}

export function generateCSVWithBOM(entries: DatevEntry[]): string {
  const csv = generateCSV(entries);
  return UTF8_BOM + csv;
}

export function generateFilename(prefix = "DATEV_Export"): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `${prefix}_${timestamp}.csv`;
}
