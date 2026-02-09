/**
 * Type definitions for ZUGFeRD/XRechnung parsing
 */

export interface ZUGFeRDMetaData {
  xmlVersion?: string;
  profile?: string;
  flavor?: 'EXTENDED' | 'EN16931' | 'BASIC' | 'BASIC WL' | 'MINIMUM';
}

export interface ZUGFeRDTax {
  typeCode?: string;
  categoryCode?: string;
  ratePercent?: string;
  basisAmount?: string;
  calculatedAmount?: string;
}

export interface ZUGFeRDTradeLineItem {
  id?: string;
  name?: string;
  description?: string;
  unitCode?: string;
  unitPrice?: string;
  billedQuantity?: string;
  lineTotalAmount?: string;
  taxRatePercent?: string;
  taxCategoryCode?: string;
}

export interface ZUGFeRDParty {
  id?: string;
  name?: string;
  description?: string;
  legalForm?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  postcode?: string;
  city?: string;
  countryCode?: string;
  vatId?: string;
  taxRegistrationId?: string;
}

export interface ZUGFeRDPaymentTerms {
  description?: string;
  dueDate?: string;
  directDebitMandateId?: string;
}

export interface ZUGFeRDMonetarySummation {
  lineTotalAmount?: string;
  chargeTotalAmount?: string;
  allowanceTotalAmount?: string;
  taxBasisTotalAmount?: string;
  taxTotalAmount?: string;
  grandTotalAmount?: string;
  totalPrepaidAmount?: string;
  duePayableAmount?: string;
}

export interface ZUGFeRDInvoice {
  documentId?: string;
  documentType?: string;
  documentDate?: string;
  metadata: ZUGFeRDMetaData;
  seller?: ZUGFeRDParty;
  buyer?: ZUGFeRDParty;
  orderReference?: string;
  contractReference?: string;
  projectReference?: string;
  deliveryDate?: string;
  lineItems: ZUGFeRDTradeLineItem[];
  taxes: ZUGFeRDTax[];
  currency?: string;
  paymentTerms?: ZUGFeRDPaymentTerms;
  paymentMeansCode?: string;
  payeeIban?: string;
  payeeBic?: string;
  monetarySummation: ZUGFeRDMonetarySummation;
  notes?: string[];
}

export interface ParsedInvoiceResult {
  success: boolean;
  invoice?: ZUGFeRDInvoice;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type InvoiceFlavor = 'ZUGFeRD' | 'XRechnung' | 'Unknown';

export interface InvoiceDetectionResult {
  flavor: InvoiceFlavor;
  version?: string;
  profile?: string;
}
