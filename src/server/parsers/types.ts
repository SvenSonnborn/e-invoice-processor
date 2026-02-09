/**
 * Parser types and interfaces for ZUGFeRD and XRechnung
 */

import type { Invoice } from "@/src/types";

export interface ParseOptions {
  /** Validate against XSD schemas */
  validate?: boolean;
  /** Strict parsing mode - fail on missing required fields */
  strict?: boolean;
}

export interface ParseResult {
  invoice: Invoice;
  /** Original format detected */
  detectedFormat: "ZUGFERD" | "XRECHNUNG_CII" | "XRECHNUNG_UBL" | "UNKNOWN";
  /** Validation warnings if any */
  warnings?: string[];
}

/** XML namespaces used in e-invoices */
export const Namespaces = {
  // CII (Cross Industry Invoice) - used by ZUGFeRD and XRechnung
  CII: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  CII_RAM: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  CII_QDT: "urn:un:unece:uncefact:data:standard:QualifiedDataType:100",
  CII_UDT: "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
  
  // UBL (Universal Business Language) - used by XRechnung
  UBL: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  UBL_CBC: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  UBL_CAC: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  
  // ZUGFeRD/Factur-X
  ZUGFERD: "urn:zugferd:pdfa:CrossIndustryDocument:invoice:1p0#",
} as const;

/** Embedded file specification for ZUGFeRD PDFs */
export interface EmbeddedFile {
  name: string;
  content: Buffer;
  mimeType?: string;
}

/** Raw invoice data extracted from XML */
export interface RawInvoiceData {
  documentType?: string;
  documentNumber?: string;
  issueDate?: string;
  dueDate?: string;
  deliveryDate?: string;
  currency?: string;
  
  seller?: {
    name?: string;
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    vatId?: string;
    taxId?: string;
  };
  
  buyer?: {
    name?: string;
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    vatId?: string;
    taxId?: string;
  };
  
  lineItems?: Array<{
    id?: string;
    description?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    lineTotal?: number;
    vatRate?: number;
  }>;
  
  totals?: {
    netAmount?: number;
    taxAmount?: number;
    grossAmount?: number;
    vatBreakdown?: Array<{
      rate?: number;
      baseAmount?: number;
      taxAmount?: number;
    }>;
  };
  
  payment?: {
    iban?: string;
    bic?: string;
    terms?: string;
  };
}
