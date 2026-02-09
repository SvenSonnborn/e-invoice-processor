/**
 * Error types for e-invoice parsing
 */

export class InvoiceParseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "InvoiceParseError";
  }
}

export class XmlValidationError extends InvoiceParseError {
  constructor(
    message: string,
    public readonly validationErrors: string[],
    details?: Record<string, unknown>
  ) {
    super(message, "XML_VALIDATION_ERROR", details);
    this.name = "XmlValidationError";
  }
}

export class PdfExtractionError extends InvoiceParseError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, "PDF_EXTRACTION_ERROR", details);
    this.name = "PdfExtractionError";
  }
}

export class UnsupportedFormatError extends InvoiceParseError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, "UNSUPPORTED_FORMAT_ERROR", details);
    this.name = "UnsupportedFormatError";
  }
}
