/**
 * DATEV Export Validator
 */

import type { DatevEntry, DatevValidationError, DatevExportConfig } from "./types";
import { DATEV_CONSTRAINTS } from "./constants";

export function validateDatevEntry(entry: DatevEntry): DatevValidationError[] {
  const errors: DatevValidationError[] = [];

  if (!entry.datum || !/^[0-3]\d[0-1]\d\d{4}$/.test(entry.datum)) {
    errors.push({
      field: "datum",
      message: `Datum muss im Format DDMMYYYY vorliegen`,
      value: entry.datum,
    });
  }

  if (!entry.konto || entry.konto.length > DATEV_CONSTRAINTS.MAX_KONTO_LENGTH) {
    errors.push({
      field: "konto",
      message: `Konto ist erforderlich`,
      value: entry.konto,
    });
  }

  if (!entry.gegenkonto || entry.gegenkonto.length > DATEV_CONSTRAINTS.MAX_GEGENKONTO_LENGTH) {
    errors.push({
      field: "gegenkonto",
      message: `Gegenkonto ist erforderlich`,
      value: entry.gegenkonto,
    });
  }

  if (entry.umsatzSoll === 0 && entry.umsatzHaben === 0) {
    errors.push({
      field: "umsatz",
      message: "Entweder Umsatz Soll oder Umsatz Haben muss einen Wert ungleich 0 haben",
    });
  }

  if (entry.buchungstext && entry.buchungstext.length > DATEV_CONSTRAINTS.MAX_BUCHUNGSTEXT_LENGTH) {
    errors.push({
      field: "buchungstext",
      message: `Buchungstext zu lang`,
      value: entry.buchungstext,
    });
  }

  return errors;
}

export function validateExportConfig(config: DatevExportConfig): DatevValidationError[] {
  const errors: DatevValidationError[] = [];

  if (config.beraterNummer && !/^\d{1,8}$/.test(config.beraterNummer)) {
    errors.push({
      field: "beraterNummer",
      message: "Beraternummer muss eine Zahl mit maximal 8 Stellen sein",
    });
  }

  if (config.mandantenNummer && !/^\d{1,5}$/.test(config.mandantenNummer)) {
    errors.push({
      field: "mandantenNummer",
      message: "Mandantennummer muss eine Zahl mit maximal 5 Stellen sein",
    });
  }

  const validEncodings = ["UTF-8", "ISO-8859-1", "WINDOWS-1252"];
  if (!validEncodings.includes(config.encoding)) {
    errors.push({
      field: "encoding",
      message: `Ungültige Kodierung`,
      value: config.encoding,
    });
  }

  return errors;
}

export function formatAmount(amount: number): string {
  return amount.toFixed(DATEV_CONSTRAINTS.DECIMAL_PLACES).replace(".", ",");
}

export function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();
  return `${day}${month}${year}`;
}

export function formatDateFromISO(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) {
    throw new Error(`Ungültiges Datumsformat: ${isoDate}`);
  }
  return formatDate(date);
}
