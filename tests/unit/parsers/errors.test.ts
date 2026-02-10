import { describe, it, expect } from "bun:test";
import {
  ValidatorError,
  ZUGFeRDParserError,
  XRechnungParserError,
  MapperError,
} from "@/src/lib/zugferd";

describe("Parser Errors", () => {
  describe("ValidatorError", () => {
    it("should create error with message", () => {
      const error = new ValidatorError("Validation failed");
      expect(error.message).toBe("Validation failed");
      expect(error.name).toBe("ValidatorError");
    });

    it("should optionally include cause", () => {
      const cause = new Error("Root cause");
      const error = new ValidatorError("Validation failed", cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe("ZUGFeRDParserError", () => {
    it("should create error with message", () => {
      const error = new ZUGFeRDParserError("PDF extraction failed");
      expect(error.message).toBe("PDF extraction failed");
      expect(error.name).toBe("ZUGFeRDParserError");
    });
  });

  describe("XRechnungParserError", () => {
    it("should create error with message", () => {
      const error = new XRechnungParserError("XML parse failed");
      expect(error.message).toBe("XML parse failed");
      expect(error.name).toBe("XRechnungParserError");
    });
  });

  describe("MapperError", () => {
    it("should create error with message", () => {
      const error = new MapperError("Mapping failed");
      expect(error.message).toBe("Mapping failed");
      expect(error.name).toBe("MapperError");
    });

    it("should optionally include cause", () => {
      const cause = new Error("Root cause");
      const error = new MapperError("Mapping failed", cause);
      expect(error.cause).toBe(cause);
    });
  });
});
