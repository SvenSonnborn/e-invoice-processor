import { describe, it, expect } from "bun:test";
import {
  InvoiceParseError,
  XmlValidationError,
  PdfExtractionError,
  UnsupportedFormatError,
} from "@/src/server/parsers/errors";

describe("Parser Errors", () => {
  describe("InvoiceParseError", () => {
    it("should create error with code and message", () => {
      const error = new InvoiceParseError("Test error", "TEST_CODE");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("InvoiceParseError");
    });

    it("should include details when provided", () => {
      const details = { field: "test", value: 123 };
      const error = new InvoiceParseError("Test error", "TEST_CODE", details);
      expect(error.details).toEqual(details);
    });
  });

  describe("XmlValidationError", () => {
    it("should create error with validation errors", () => {
      const errors = ["Missing ID", "Invalid date"];
      const error = new XmlValidationError("Validation failed", errors);
      expect(error.message).toBe("Validation failed");
      expect(error.validationErrors).toEqual(errors);
      expect(error.code).toBe("XML_VALIDATION_ERROR");
    });
  });

  describe("PdfExtractionError", () => {
    it("should create error with details", () => {
      const error = new PdfExtractionError("PDF extraction failed", { page: 1 });
      expect(error.message).toBe("PDF extraction failed");
      expect(error.code).toBe("PDF_EXTRACTION_ERROR");
      expect(error.details).toEqual({ page: 1 });
    });
  });

  describe("UnsupportedFormatError", () => {
    it("should create error with format info", () => {
      const error = new UnsupportedFormatError("Format not supported", { format: "PDF" });
      expect(error.message).toBe("Format not supported");
      expect(error.code).toBe("UNSUPPORTED_FORMAT_ERROR");
    });
  });
});
