// Service layer entrypoint
export { OcrService, MockOcrService, getOcrService } from './ocr';
export type { IOcrService, OcrResult, OcrPage, OcrOptions } from './ocr';

export { generateExport, generateExportFilename } from './export-service';
export type { CreateExportInput, ExportResult } from './export-service';

export {
  processInvoiceOcr,
  InvoiceProcessingError,
  InvoiceProcessingErrorCode,
} from './invoice-processing';
export type {
  ProcessInvoiceParams,
  ProcessInvoiceResult,
} from './invoice-processing';

export {
  persistParsedInvoice,
  type PersistParsedInvoiceParams,
  type PersistParsedInvoiceResult,
} from './invoice-import';

export {
  validateSellerVatId,
  type VatValidationResult,
  type VatValidationStatus,
  type VatValidationReason,
} from './vat';
