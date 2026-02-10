/**
 * DATEV Export Constants
 */

export const DATEV_FORMAT = {
  DTVF: "DTVF",
  EXTF: "EXTF",
} as const;

export const DATEV_VERSION = {
  MAJOR: 700,
  FORMAT_NAME: "Buchungsstapel",
  FORMAT_VERSION: 5,
} as const;

export const DATEV_CATEGORY = {
  BUCHUNGSSTAPEL: 21,
  ADRESSEN: 16,
  WIEDERHOLENDE_BUCHUNGEN: 46,
} as const;

export const DATEV_DELIMITER = {
  FIELD: ";",
  DECIMAL: ",",
  LINE: "\r\n",
} as const;

export const DATEV_STEUERSCHLUESSEL = {
  VORSTEUER_19: "9",
  VORSTEUER_7: "8",
  VORSTEUER_0: "0",
  UST_19: "1",
  UST_7: "2",
  UST_0: "0",
  EU_REVERSE_CHARGE: "94",
  INTRA_COMMUNITY: "61",
} as const;

export const DATEV_KONTEN = {
  KASSE: "1000",
  BANK: "1200",
  FORDERUNGEN: "1400",
  VERBINDLICHKEITEN: "1600",
  UMSATZSTEUER_19: "1776",
  UMSATZSTEUER_7: "1775",
  AUFWAND_WAREN: "5000",
  AUFWAND_DIENSTLEISTUNGEN: "6000",
  ERLOES_WAREN: "8000",
  ERLOES_DIENSTLEISTUNGEN: "8200",
} as const;

export const DEFAULT_ACCOUNT_MAPPING = {
  EINGANG_KONTO: "4400",
  EINGANG_GEGENKONTO: "5000",
  AUSGANG_KONTO: "1200",
  AUSGANG_GEGENKONTO: "8000",
  BANK_KONTO: "1200",
} as const;

export const DATEV_CONSTRAINTS = {
  MAX_BUCHUNGSTEXT_LENGTH: 60,
  MAX_KONTO_LENGTH: 9,
  MAX_GEGENKONTO_LENGTH: 9,
  MAX_BELEGNUMMER_LENGTH: 12,
  MAX_KOSTENSTELLE_LENGTH: 8,
  MAX_KOSTENTRAEGER_LENGTH: 8,
  MAX_AMOUNT: 999999999999.99,
  DECIMAL_PLACES: 2,
  DATE_FORMAT: "DDMMYYYY",
  DATE_FORMAT_DISPLAY: "DD.MM.YYYY",
} as const;

export const UTF8_BOM = "\uFEFF";

export const DEFAULT_EXPORT_CONFIG = {
  format: DATEV_FORMAT.DTVF,
  version: DATEV_VERSION.MAJOR,
  category: DATEV_CATEGORY.BUCHUNGSSTAPEL,
  currency: "EUR",
  encoding: "UTF-8" as const,
  reserved: "",
} as const;

export const DATEV_HEADER_FIELDS = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
  "Postensperre",
  "Diverse Adressnummer",
  "Geschäftspartnerbank",
  "Sperre",
  "Zahlungsbedingung",
  "Fälligkeit",
  "Generalumkehr (GU)",
  "Mahn-/Zahlshinweis",
  "Skontobetragsperre",
  "Zahlungsbetrag",
  "Bezeichnung Zahlungsbetrag",
  "Kostenstelle",
  "Kostenträger",
  "Kostenart",
] as const;
