/**
 * DATEV Export Module
 */

export {
  formatInvoicesForDatev,
  formatInvoiceForDatev,
  exportInvoicesToBuffer,
  previewExport,
  getExportSummary,
  DEFAULT_EXPORT_OPTIONS,
} from './formatter';

export type {
  DatevEntry,
  DatevHeader,
  DatevExportConfig,
  DatevInvoiceMapping,
  DatevInvoice,
  DatevLineItem,
  DatevExportResult,
  DatevValidationError,
} from './types';

export type { DatevExportOptions } from './formatter';

export {
  DATEV_FORMAT,
  DATEV_VERSION,
  DATEV_CATEGORY,
  DATEV_DELIMITER,
  DATEV_STEUERSCHLUESSEL,
  DATEV_KONTEN,
  DEFAULT_ACCOUNT_MAPPING,
  DATEV_CONSTRAINTS,
  DATEV_HEADER_FIELDS,
  UTF8_BOM,
  DEFAULT_EXPORT_CONFIG,
} from './constants';

export {
  validateDatevEntry,
  validateExportConfig,
  formatAmount,
  formatDate,
  formatDateFromISO,
} from './validator';

export {
  mapInvoiceToDatevEntries,
  mapInvoiceWithLineItemsToDatevEntries,
  mapTaxRateToSteuerschluessel,
  suggestKonto,
  DEFAULT_INVOICE_MAPPING,
} from './mapper';

export {
  generateHeader,
  generateExtendedHeader,
  generateRow,
  generateCSV,
  generateCSVWithBOM,
  generateExtendedCSV,
  generateCSVBuffer,
  generateFilename,
  generateStructuredFilename,
  escapeCsvField,
  parseCsvLine,
} from './csv-generator';
