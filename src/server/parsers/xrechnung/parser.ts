/**
 * XRechnung Parser
 * Supports both CII (Cross Industry Invoice) and UBL formats
 */

import type { Invoice } from "@/src/types";
import type { ParseOptions, ParseResult } from "../types";
import { parseXml } from "../xml-utils";
import { parseCiiXml } from "../cii";
import { parseUblXml } from "../ubl";
import { mapToInvoice } from "../mapper";
import { InvoiceParseError, XmlValidationError, UnsupportedFormatError } from "../errors";

/**
 * Parse an XRechnung XML file
 * Automatically detects CII or UBL format
 * @param xmlBuffer - The XML file content
 * @param options - Parse options
 * @returns ParseResult with the parsed invoice
 */
export async function parseXRechnung(
  xmlBuffer: Buffer,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const { validate = true, strict = false } = options;
  
  try {
    // Convert buffer to string
    const xmlContent = xmlBuffer.toString("utf-8");
    
    // Parse and validate XML
    const { parsed, format, warnings } = parseXml(xmlContent, validate);
    
    if (format === "UNKNOWN") {
      throw new UnsupportedFormatError(
        "Could not determine XRechnung format. Expected CII or UBL XML.",
        { supportedFormats: ["CII", "UBL"] }
      );
    }
    
    // Parse based on detected format
    let rawData;
    let detectedFormat: ParseResult["detectedFormat"];
    
    if (format === "CII") {
      rawData = parseCiiXml(parsed);
      detectedFormat = "XRECHNUNG_CII";
    } else {
      rawData = parseUblXml(parsed);
      detectedFormat = "XRECHNUNG_UBL";
    }
    
    // Map to Invoice model
    const invoice = mapToInvoice(rawData, "XRECHNUNG");
    
    // Check for validation errors in strict mode
    if (strict && warnings.length > 0) {
      throw new InvoiceParseError(
        "Invoice validation failed in strict mode",
        "VALIDATION_ERROR",
        { warnings }
      );
    }
    
    return {
      invoice,
      detectedFormat,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
    
  } catch (error) {
    // Re-throw known errors as-is
    if (error instanceof InvoiceParseError) {
      throw error;
    }
    
    // Handle XML parsing errors specifically
    if (error instanceof Error && error.message.includes("XML")) {
      throw new XmlValidationError(
        `XML parsing failed: ${error.message}`,
        [error.message]
      );
    }
    
    // Wrap other errors
    throw new InvoiceParseError(
      `Failed to parse XRechnung: ${error instanceof Error ? error.message : "Unknown error"}`,
      "PARSE_ERROR",
      { originalError: error instanceof Error ? error.message : undefined }
    );
  }
}

/**
 * Parse XRechnung in CII format specifically
 * @param xmlBuffer - The XML file content
 * @param options - Parse options
 * @returns ParseResult with the parsed invoice
 */
export async function parseXRechnungCii(
  xmlBuffer: Buffer,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const { validate = true, strict = false } = options;
  
  try {
    const xmlContent = xmlBuffer.toString("utf-8");
    const { parsed, warnings } = parseXml(xmlContent, validate);
    
    const rawData = parseCiiXml(parsed);
    const invoice = mapToInvoice(rawData, "XRECHNUNG");
    
    if (strict && warnings.length > 0) {
      throw new InvoiceParseError(
        "Invoice validation failed in strict mode",
        "VALIDATION_ERROR",
        { warnings }
      );
    }
    
    return {
      invoice,
      detectedFormat: "XRECHNUNG_CII",
      warnings: warnings.length > 0 ? warnings : undefined,
    };
    
  } catch (error) {
    if (error instanceof InvoiceParseError) {
      throw error;
    }
    throw new InvoiceParseError(
      `Failed to parse XRechnung CII: ${error instanceof Error ? error.message : "Unknown error"}`,
      "PARSE_ERROR"
    );
  }
}

/**
 * Parse XRechnung in UBL format specifically
 * @param xmlBuffer - The XML file content
 * @param options - Parse options
 * @returns ParseResult with the parsed invoice
 */
export async function parseXRechnungUbl(
  xmlBuffer: Buffer,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const { validate = true, strict = false } = options;
  
  try {
    const xmlContent = xmlBuffer.toString("utf-8");
    const { parsed, warnings } = parseXml(xmlContent, validate);
    
    const rawData = parseUblXml(parsed);
    const invoice = mapToInvoice(rawData, "XRECHNUNG");
    
    if (strict && warnings.length > 0) {
      throw new InvoiceParseError(
        "Invoice validation failed in strict mode",
        "VALIDATION_ERROR",
        { warnings }
      );
    }
    
    return {
      invoice,
      detectedFormat: "XRECHNUNG_UBL",
      warnings: warnings.length > 0 ? warnings : undefined,
    };
    
  } catch (error) {
    if (error instanceof InvoiceParseError) {
      throw error;
    }
    throw new InvoiceParseError(
      `Failed to parse XRechnung UBL: ${error instanceof Error ? error.message : "Unknown error"}`,
      "PARSE_ERROR"
    );
  }
}

/**
 * Detect if XML content is XRechnung CII format
 * @param xmlContent - The XML content as string
 * @returns true if CII format detected
 */
export function isXRechnungCii(xmlContent: string): boolean {
  return xmlContent.includes("urn:un:unece:uncefact:data:standard:CrossIndustryInvoice") ||
         xmlContent.includes("CrossIndustryInvoice");
}

/**
 * Detect if XML content is XRechnung UBL format
 * @param xmlContent - The XML content as string
 * @returns true if UBL format detected
 */
export function isXRechnungUbl(xmlContent: string): boolean {
  return (xmlContent.includes("<Invoice") || xmlContent.includes("<Invoice ")) &&
         (xmlContent.includes("urn:oasis:names:specification:ubl") ||
          xmlContent.includes("xmlns:cbc=") ||
          xmlContent.includes("xmlns:cac="));
}
