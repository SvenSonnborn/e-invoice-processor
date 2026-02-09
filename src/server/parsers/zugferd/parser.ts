/**
 * ZUGFeRD 2.3 Parser
 * Extracts and parses XML from ZUGFeRD/Factur-X PDF files
 */

import { PDFDocument, PDFName, PDFStream, PDFDict, PDFArray } from "pdf-lib";
import type { Invoice } from "@/src/types";
import type { ParseOptions, ParseResult, RawInvoiceData, EmbeddedFile } from "../types";
import { parseXml } from "../xml-utils";
import { parseCiiXml } from "../cii";
import { mapToInvoice } from "../mapper";
import { InvoiceParseError, PdfExtractionError, UnsupportedFormatError } from "../errors";

/** Options for ZUGFeRD parsing */
export type ZugferdParseOptions = ParseOptions;

/** ZUGFeRD/Factur-X filename patterns */
const ZUGFERD_XML_FILENAME_PATTERNS = [
  /zugferd/i,
  /factur-x/i,
  /xrechnung/i,
  /\.xml$/i,
];

/** PDFAF schema namespace for embedded files */
const PDFAF_SCHEMA_NS = "http://www.aiim.org/pdfa/ns/schema#";

/**
 * Parse a ZUGFeRD PDF file
 * @param pdfBuffer - The PDF file content
 * @param options - Parse options
 * @returns ParseResult with the parsed invoice
 */
export async function parseZugferd(
  pdfBuffer: Buffer, 
  options: ParseOptions = {}
): Promise<ParseResult> {
  const { validate = true, strict = false } = options;
  
  try {
    // Extract XML from PDF
    const embeddedXml = await extractEmbeddedXml(pdfBuffer);
    
    if (!embeddedXml) {
      throw new PdfExtractionError(
        "No ZUGFeRD/Factur-X XML found in PDF",
        { hint: "Ensure the PDF is a valid ZUGFeRD 2.3 or Factur-X invoice" }
      );
    }
    
    // Parse the XML
    const { parsed, format, warnings } = parseXml(embeddedXml.toString("utf-8"), validate);
    
    if (format !== "CII") {
      throw new UnsupportedFormatError(
        `Expected CII format in ZUGFeRD PDF, but detected: ${format}`,
        { detectedFormat: format }
      );
    }
    
    // Convert to raw invoice data
    const rawData = parseCiiXml(parsed);
    
    // Map to Invoice model
    const invoice = mapToInvoice(rawData, "ZUGFERD");
    
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
      detectedFormat: "ZUGFERD",
      warnings: warnings.length > 0 ? warnings : undefined,
    };
    
  } catch (error) {
    // Re-throw InvoiceParseError as-is
    if (error instanceof InvoiceParseError) {
      throw error;
    }
    
    // Wrap other errors
    throw new InvoiceParseError(
      `Failed to parse ZUGFeRD PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
      "PARSE_ERROR",
      { originalError: error instanceof Error ? error.message : undefined }
    );
  }
}

/**
 * Extract embedded XML from a ZUGFeRD PDF
 * @param pdfBuffer - The PDF file content
 * @returns Buffer containing the XML content, or null if not found
 */
export async function extractEmbeddedXml(pdfBuffer: Buffer): Promise<Buffer | null> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Try to find embedded files in the PDF
    const catalog = pdfDoc.catalog as unknown as PDFDict;
    
    // Look for EmbeddedFiles name tree
    const names = catalog.get(PDFName.of("Names")) as PDFDict | undefined;
    if (!names) return null;
    
    const embeddedFiles = names.get(PDFName.of("EmbeddedFiles")) as PDFDict | undefined;
    if (!embeddedFiles) return null;
    
    // Get the name tree
    const namesArray = embeddedFiles.get(PDFName.of("Names")) as PDFArray | undefined;
    if (!namesArray) return null;
    
    // Iterate through name-value pairs
    const files: EmbeddedFile[] = [];
    for (let i = 0; i < namesArray.size(); i += 2) {
      const nameObj = namesArray.get(i);
      const fileSpecRef = namesArray.get(i + 1);
      
      if (!nameObj || !fileSpecRef) continue;
      
      const name = nameObj instanceof PDFName ? nameObj.asString() : String(nameObj);
      const fileSpec = pdfDoc.context.lookup(fileSpecRef as ReturnType<typeof PDFName.of>) as PDFDict | undefined;
      
      if (!fileSpec) continue;
      
      // Look for embedded file stream
      const ef = fileSpec.get(PDFName.of("EF")) as PDFDict | undefined;
      if (!ef) continue;
      
      const fStreamRef = ef.get(PDFName.of("F"));
      if (!fStreamRef) continue;
      
      const fStream = pdfDoc.context.lookup(fStreamRef as ReturnType<typeof PDFName.of>) as PDFStream | undefined;
      if (!fStream) continue;
      
      // Get the stream content
      const content = fStream.getContents();
      if (!content) continue;
      
      // Determine MIME type
      const subtype = fileSpec.get(PDFName.of("Subtype"));
      const mimeType = subtype instanceof PDFName ? subtype.asString() : undefined;
      
      files.push({
        name: name.replace(/^\//, ""), // Remove leading slash
        content: Buffer.from(content),
        mimeType,
      });
    }
    
    // Find the ZUGFeRD/Factur-X XML file
    const zugferdFile = files.find(f => 
      ZUGFERD_XML_FILENAME_PATTERNS.some(pattern => pattern.test(f.name))
    );
    
    if (zugferdFile) {
      return zugferdFile.content;
    }
    
    // Fallback: return first XML file found
    const xmlFile = files.find(f => 
      f.name.endsWith(".xml") || 
      f.mimeType === "text/xml" ||
      f.mimeType === "application/xml"
    );
    
    return xmlFile?.content || null;
    
  } catch (error) {
    throw new PdfExtractionError(
      `Failed to extract XML from PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
      { originalError: error instanceof Error ? error.message : undefined }
    );
  }
}

/**
 * Check if a PDF is a ZUGFeRD/Factur-X invoice
 * @param pdfBuffer - The PDF file content
 * @returns true if the PDF contains ZUGFeRD data
 */
export async function isZugferdPdf(pdfBuffer: Buffer): Promise<boolean> {
  try {
    const xml = await extractEmbeddedXml(pdfBuffer);
    if (!xml) return false;
    
    const xmlStr = xml.toString("utf-8");
    return xmlStr.includes("CrossIndustryInvoice") || 
           xmlStr.includes("zugferd") ||
           xmlStr.includes("factur-x");
  } catch {
    return false;
  }
}
