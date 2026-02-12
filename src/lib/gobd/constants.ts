/**
 * GoBD Constants
 * German tax compliance requirements (GoBD - Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern)
 */

// Valid German VAT rates (in percent)
export const VALID_TAX_RATES = [0, 7, 19] as const;

// Default currency for German invoices
export const DEFAULT_CURRENCY = 'EUR';

// Maximum allowed deviation for sum validation (accounting for rounding errors)
export const SUM_TOLERANCE = 0.01;

// GoBD compliance badge types
export type GoBDComplianceStatus = 'compliant' | 'non-compliant' | 'warning';

// Violation severity levels
export type ViolationSeverity = 'error' | 'warning';

// Required fields for GoBD compliance
export const REQUIRED_FIELDS = {
  invoice: [
    'number',
    'issueDate',
    'netAmount',
    'taxAmount',
    'grossAmount',
    'currency',
    'supplierName',
    'customerName',
  ],
  lineItem: ['description', 'netAmount', 'taxRate'],
} as const;

// GoBD validation error codes
export const GOB_ERROR_CODES = {
  // Required field violations
  MISSING_INVOICE_NUMBER: 'GOB-001',
  MISSING_ISSUE_DATE: 'GOB-002',
  MISSING_NET_AMOUNT: 'GOB-003',
  MISSING_TAX_AMOUNT: 'GOB-004',
  MISSING_GROSS_AMOUNT: 'GOB-005',
  MISSING_CURRENCY: 'GOB-006',
  MISSING_SUPPLIER: 'GOB-007',
  MISSING_CUSTOMER: 'GOB-008',

  // Calculation violations
  SUM_MISMATCH: 'GOB-101',
  LINE_ITEM_SUM_MISMATCH: 'GOB-102',
  TAX_CALCULATION_ERROR: 'GOB-103',

  // Date violations
  FUTURE_DATE: 'GOB-201',
  INVALID_DATE_FORMAT: 'GOB-202',

  // Tax rate violations
  INVALID_TAX_RATE: 'GOB-301',
  TAX_RATE_MISMATCH: 'GOB-302',

  // Currency violations
  INVALID_CURRENCY: 'GOB-401',

  // Line item violations
  MISSING_LINE_ITEM_DESCRIPTION: 'GOB-501',
  MISSING_LINE_ITEM_NET_AMOUNT: 'GOB-502',
  MISSING_LINE_ITEM_TAX_RATE: 'GOB-503',
} as const;

// Error messages in German (for user-facing messages)
export const GOB_ERROR_MESSAGES: Record<string, string> = {
  [GOB_ERROR_CODES.MISSING_INVOICE_NUMBER]: 'Rechnungsnummer fehlt',
  [GOB_ERROR_CODES.MISSING_ISSUE_DATE]: 'Rechnungsdatum fehlt',
  [GOB_ERROR_CODES.MISSING_NET_AMOUNT]: 'Nettobetrag fehlt',
  [GOB_ERROR_CODES.MISSING_TAX_AMOUNT]: 'Steuerbetrag fehlt',
  [GOB_ERROR_CODES.MISSING_GROSS_AMOUNT]: 'Bruttobetrag fehlt',
  [GOB_ERROR_CODES.MISSING_CURRENCY]: 'Währung fehlt',
  [GOB_ERROR_CODES.MISSING_SUPPLIER]: 'Lieferantenname fehlt',
  [GOB_ERROR_CODES.MISSING_CUSTOMER]: 'Kundenname fehlt',
  [GOB_ERROR_CODES.SUM_MISMATCH]:
    'Summenprüfung fehlgeschlagen (Netto + Steuer ≠ Brutto)',
  [GOB_ERROR_CODES.LINE_ITEM_SUM_MISMATCH]:
    'Positionssumme stimmt nicht mit Rechnungssumme überein',
  [GOB_ERROR_CODES.TAX_CALCULATION_ERROR]: 'Steuerberechnung fehlerhaft',
  [GOB_ERROR_CODES.FUTURE_DATE]:
    'Rechnungsdatum darf nicht in der Zukunft liegen',
  [GOB_ERROR_CODES.INVALID_DATE_FORMAT]: 'Ungültiges Datumsformat',
  [GOB_ERROR_CODES.INVALID_TAX_RATE]:
    'Ungültiger Steuersatz (erlaubt: 0%, 7%, 19%)',
  [GOB_ERROR_CODES.TAX_RATE_MISMATCH]:
    'Steuersatz stimmt nicht mit Berechnung überein',
  [GOB_ERROR_CODES.INVALID_CURRENCY]: 'Ungültige Währung',
  [GOB_ERROR_CODES.MISSING_LINE_ITEM_DESCRIPTION]:
    'Positionsbeschreibung fehlt',
  [GOB_ERROR_CODES.MISSING_LINE_ITEM_NET_AMOUNT]: 'Positions-Nettobetrag fehlt',
  [GOB_ERROR_CODES.MISSING_LINE_ITEM_TAX_RATE]: 'Positions-Steuersatz fehlt',
};

// Warning codes for non-critical issues
export const GOB_WARNING_CODES = {
  UNCOMMON_CURRENCY: 'GOB-W001',
  MISSING_DUE_DATE: 'GOB-W002',
  NO_LINE_ITEMS: 'GOB-W003',
} as const;

export const GOB_WARNING_MESSAGES: Record<string, string> = {
  [GOB_WARNING_CODES.UNCOMMON_CURRENCY]:
    'Unübliche Währung für deutsche Rechnung',
  [GOB_WARNING_CODES.MISSING_DUE_DATE]: 'Zahlungsziel (Fälligkeitsdatum) fehlt',
  [GOB_WARNING_CODES.NO_LINE_ITEMS]: 'Keine Rechnungspositionen vorhanden',
};
