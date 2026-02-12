// Service layer entrypoint
export { OcrService, MockOcrService, getOcrService } from './ocr';
export type { IOcrService, OcrResult, OcrPage, OcrOptions } from './ocr';

export { generateExport, generateExportFilename } from './export-service';
export type { CreateExportInput, ExportResult } from './export-service';
