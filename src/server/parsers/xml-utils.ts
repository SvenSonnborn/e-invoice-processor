/**
 * XML validation utilities for e-invoices
 */

import { XMLValidator, XMLParser } from "fast-xml-parser";
import { XmlValidationError } from "./errors";
import type { RawInvoiceData } from "./types";

/** Validate XML is well-formed */
export function validateXmlWellFormed(xmlContent: string): void {
  const validationResult = XMLValidator.validate(xmlContent);
  
  if (validationResult !== true) {
    throw new XmlValidationError(
      "XML is not well-formed",
      [validationResult.err?.msg || "Unknown XML parsing error"],
      { line: validationResult.err?.line, column: validationResult.err?.col }
    );
  }
}

/** Detect the invoice format from XML content */
export function detectXmlFormat(xmlContent: string): "CII" | "UBL" | "UNKNOWN" {
  // Check for CII (Cross Industry Invoice) - used by ZUGFeRD and XRechnung CII
  if (xmlContent.includes("CrossIndustryInvoice") ||
      xmlContent.includes("urn:un:unece:uncefact:data:standard:CrossIndustryInvoice")) {
    return "CII";
  }
  
  // Check for UBL (Universal Business Language) - used by XRechnung UBL
  if (xmlContent.includes("<Invoice") &&
      (xmlContent.includes("urn:oasis:names:specification:ubl") ||
       xmlContent.includes("xmlns:cbc") ||
       xmlContent.includes("xmlns:cac"))) {
    return "UBL";
  }
  
  return "UNKNOWN";
}

/** Check if the XML conforms to CII schema structure */
export function validateCiiStructure(parsedXml: unknown): string[] {
  const warnings: string[] = [];
  const cii = parsedXml as Record<string, unknown>;
  
  // Check required root element
  if (!cii.CrossIndustryInvoice) {
    warnings.push("Missing root element 'CrossIndustryInvoice'");
    return warnings;
  }
  
  const root = cii.CrossIndustryInvoice as Record<string, unknown>;
  
  // Check required sections
  if (!root.ExchangedDocumentContext) {
    warnings.push("Missing 'ExchangedDocumentContext' section");
  }
  
  if (!root.ExchangedDocument) {
    warnings.push("Missing 'ExchangedDocument' section");
  } else {
    const doc = root.ExchangedDocument as Record<string, unknown>;
    if (!doc.ID) warnings.push("Missing document ID");
    if (!doc.TypeCode) warnings.push("Missing document type code");
    if (!doc.IssueDateTime) warnings.push("Missing issue date");
  }
  
  if (!root.SupplyChainTradeTransaction) {
    warnings.push("Missing 'SupplyChainTradeTransaction' section");
  } else {
    const transaction = root.SupplyChainTradeTransaction as Record<string, unknown>;
    
    if (!transaction.ApplicableHeaderTradeAgreement) {
      warnings.push("Missing 'ApplicableHeaderTradeAgreement' section");
    } else {
      const agreement = transaction.ApplicableHeaderTradeAgreement as Record<string, unknown>;
      if (!agreement.SellerTradeParty) warnings.push("Missing seller information");
      if (!agreement.BuyerTradeParty) warnings.push("Missing buyer information");
    }
    
    if (!transaction.ApplicableHeaderTradeSettlement) {
      warnings.push("Missing 'ApplicableHeaderTradeSettlement' section");
    }
  }
  
  return warnings;
}

/** Check if the XML conforms to UBL schema structure */
export function validateUblStructure(parsedXml: unknown): string[] {
  const warnings: string[] = [];
  const ubl = parsedXml as Record<string, unknown>;
  
  // Check required root element
  if (!ubl.Invoice) {
    warnings.push("Missing root element 'Invoice'");
    return warnings;
  }
  
  const inv = ubl.Invoice as Record<string, unknown>;
  
  // Check required fields
  if (!inv.ID) warnings.push("Missing invoice ID");
  if (!inv.IssueDate) warnings.push("Missing issue date");
  if (!inv.InvoiceTypeCode) warnings.push("Missing invoice type code");
  if (!inv.DocumentCurrencyCode) warnings.push("Missing document currency code");
  
  if (!inv.AccountingSupplierParty) {
    warnings.push("Missing supplier information");
  }
  
  if (!inv.AccountingCustomerParty) {
    warnings.push("Missing customer information");
  }
  
  if (!inv.LegalMonetaryTotal) {
    warnings.push("Missing monetary totals");
  }
  
  return warnings;
}

/** Parse XML content to JavaScript object with validation */
export function parseXml(xmlContent: string, validate = true): { parsed: unknown; format: "CII" | "UBL" | "UNKNOWN"; warnings: string[] } {
  // First check if XML is well-formed
  if (validate) {
    validateXmlWellFormed(xmlContent);
  }
  
  // Detect format
  const format = detectXmlFormat(xmlContent);
  
  // Configure parser
  const parserOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
    removeNSPrefix: true,  // Remove namespace prefixes like cbc:, cac:
    isArray: (name: string) => {
      // Fields that should always be arrays
      const arrayFields = [
        "IncludedSupplyChainTradeLineItem",
        "SpecifiedTradeSettlementLineMonetarySummation",
        "ApplicableTradeTax",
        "SpecifiedTaxRegistration",
        "InvoiceLine",
        "TaxTotalAmount",
        "LineTotalAmount"
      ];
      return arrayFields.includes(name);
    },
  };
  
  const parser = new XMLParser(parserOptions);
  const parsed = parser.parse(xmlContent);
  
  // Validate structure based on format
  let warnings: string[] = [];
  if (validate && format !== "UNKNOWN") {
    warnings = format === "CII" 
      ? validateCiiStructure(parsed)
      : validateUblStructure(parsed);
  }
  
  return { parsed, format, warnings };
}

/** Get the namespace prefix from XML content */
export function getNamespacePrefix(xmlContent: string, namespaceUri: string): string | null {
  const regex = new RegExp(`xmlns:([^\\s=]+)=["']${namespaceUri}["']`);
  const match = xmlContent.match(regex);
  return match?.[1] || null;
}

/** Extract text value from possibly nested XML structure */
export function extractTextValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  
  if (typeof value === "string") {
    return value;
  }
  
  if (typeof value === "number") {
    return value.toString();
  }
  
  if (typeof value === "object") {
    // Check for #text property (common in parsed XML)
    const obj = value as Record<string, unknown>;
    if ("#text" in obj) {
      return String(obj["#text"]);
    }
    // Check for value property
    if ("@_value" in obj) {
      return String(obj["@_value"]);
    }
  }
  
  return undefined;
}

/** Extract amount value considering currency */
export function extractAmount(value: unknown): { amount: number; currency?: string } | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  
  let amount: number | undefined;
  let currency: string | undefined;
  
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    
    // Get text content
    const textValue = extractTextValue(value);
    if (textValue) {
      amount = parseFloat(textValue);
    }
    
    // Get currency from attribute
    if ("@_currencyID" in obj) {
      currency = String(obj["@_currencyID"]);
    }
  } else if (typeof value === "string") {
    amount = parseFloat(value);
  } else if (typeof value === "number") {
    amount = value;
  }
  
  if (amount === undefined || isNaN(amount)) {
    return undefined;
  }
  
  return { amount, currency };
}

/** Extract date from CII format (format: 102 = YYYYMMDD, 610 = YYYYMM) */
export function extractCiiDate(dateTimeValue: unknown): string | undefined {
  if (!dateTimeValue) return undefined;
  
  const obj = dateTimeValue as Record<string, unknown>;
  const dateTimeString = obj.DateTimeString as Record<string, unknown> | undefined;
  const dateString = extractTextValue(dateTimeString);
  const format = (dateTimeString?.["@_format"] as string | undefined) || "102";
  
  if (!dateString) return undefined;
  
  // Format 102: YYYYMMDD
  if (format === "102" && dateString.length === 8) {
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  // Format 610: YYYYMM
  if (format === "610" && dateString.length === 6) {
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    return `${year}-${month}`;
  }
  
  // Return as-is if format not recognized
  return dateString;
}
