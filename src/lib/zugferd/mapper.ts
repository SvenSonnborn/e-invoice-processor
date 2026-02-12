/**
 * Mapper - Maps parsed ZUGFeRD/XRechnung data to Invoice model
 */

import {
  Invoice,
  InvoiceFormat,
  InvoiceParty,
  InvoiceTotals,
} from '@/src/types/invoice';
import {
  ZUGFeRDInvoice,
  ZUGFeRDParty,
  ZUGFeRDMonetarySummation,
} from './types';
import { randomUUID } from 'crypto';

export class MapperError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'MapperError';
  }
}

export function mapToInvoiceModel(
  zugferdInvoice: ZUGFeRDInvoice,
  _sourceFileName?: string
): Invoice {
  try {
    const format: InvoiceFormat = determineInvoiceFormat(zugferdInvoice);

    return {
      id: randomUUID(),
      format,
      number: zugferdInvoice.documentId,
      supplier: mapParty(zugferdInvoice.seller),
      customer: mapParty(zugferdInvoice.buyer),
      issueDate: zugferdInvoice.documentDate,
      dueDate: zugferdInvoice.paymentTerms?.dueDate || zugferdInvoice.dueDate,
      totals: mapTotals(
        zugferdInvoice.monetarySummation,
        zugferdInvoice.currency
      ),
    };
  } catch (error) {
    throw new MapperError(
      'Failed to map ZUGFeRD invoice to Invoice model',
      error instanceof Error ? error : undefined
    );
  }
}

function determineInvoiceFormat(zugferdInvoice: ZUGFeRDInvoice): InvoiceFormat {
  const profile = zugferdInvoice.metadata?.profile?.toLowerCase() || '';
  if (profile.includes('xrechnung') || profile.includes('x-rechnung'))
    return 'XRECHNUNG';
  if (zugferdInvoice.metadata?.flavor) return 'ZUGFERD';
  return 'UNKNOWN';
}

function mapParty(
  zugferdParty: ZUGFeRDParty | undefined
): InvoiceParty | undefined {
  if (!zugferdParty) return undefined;
  return { name: zugferdParty.name || zugferdParty.id || 'Unknown' };
}

function mapTotals(
  summation: ZUGFeRDMonetarySummation | undefined,
  currency: string | undefined
): InvoiceTotals | undefined {
  if (!summation && !currency) return undefined;
  return {
    currency: currency || 'EUR',
    netAmount: summation?.taxBasisTotalAmount || summation?.lineTotalAmount,
    taxAmount: summation?.taxTotalAmount,
    grossAmount: summation?.grandTotalAmount,
  };
}

export interface ExtendedInvoiceData {
  rawData: ZUGFeRDInvoice;
  lineItems: Array<{
    id?: string;
    name?: string;
    description?: string;
    quantity?: string;
    unitPrice?: string;
    totalAmount?: string;
  }>;
  taxes: Array<{
    typeCode?: string;
    categoryCode?: string;
    ratePercent?: string;
    basisAmount?: string;
    calculatedAmount?: string;
  }>;
  supplierDetails?: {
    address?: {
      line1?: string;
      line2?: string;
      line3?: string;
      postcode?: string;
      city?: string;
      countryCode?: string;
    };
    contact?: { name?: string; phone?: string; email?: string };
    vatId?: string;
  };
  customerDetails?: {
    address?: {
      line1?: string;
      line2?: string;
      line3?: string;
      postcode?: string;
      city?: string;
      countryCode?: string;
    };
    vatId?: string;
  };
  paymentDetails?: {
    terms?: string;
    dueDate?: string;
    meansCode?: string;
    iban?: string;
    bic?: string;
    accountName?: string;
    mandateId?: string;
  };
  references?: {
    orderReference?: string;
    contractReference?: string;
    projectReference?: string;
  };
  delivery?: { date?: string };
  notes?: string[];
}

export function mapToExtendedInvoiceData(
  zugferdInvoice: ZUGFeRDInvoice
): ExtendedInvoiceData {
  return {
    rawData: zugferdInvoice,
    lineItems:
      zugferdInvoice.lineItems?.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.billedQuantity,
        unitPrice: item.unitPrice,
        totalAmount: item.lineTotalAmount,
      })) || [],
    taxes:
      zugferdInvoice.taxes?.map((tax) => ({
        typeCode: tax.typeCode,
        categoryCode: tax.categoryCode,
        ratePercent: tax.ratePercent,
        basisAmount: tax.basisAmount,
        calculatedAmount: tax.calculatedAmount,
      })) || [],
    supplierDetails: zugferdInvoice.seller
      ? {
          address: {
            line1: zugferdInvoice.seller.addressLine1,
            line2: zugferdInvoice.seller.addressLine2,
            line3: zugferdInvoice.seller.addressLine3,
            postcode: zugferdInvoice.seller.postcode,
            city: zugferdInvoice.seller.city,
            countryCode: zugferdInvoice.seller.countryCode,
          },
          contact: {
            name: zugferdInvoice.seller.contactName,
            phone: zugferdInvoice.seller.contactPhone,
            email: zugferdInvoice.seller.contactEmail,
          },
          vatId: zugferdInvoice.seller.vatId,
        }
      : undefined,
    customerDetails: zugferdInvoice.buyer
      ? {
          address: {
            line1: zugferdInvoice.buyer.addressLine1,
            line2: zugferdInvoice.buyer.addressLine2,
            line3: zugferdInvoice.buyer.addressLine3,
            postcode: zugferdInvoice.buyer.postcode,
            city: zugferdInvoice.buyer.city,
            countryCode: zugferdInvoice.buyer.countryCode,
          },
          vatId: zugferdInvoice.buyer.vatId,
        }
      : undefined,
    paymentDetails: {
      terms: zugferdInvoice.paymentTerms?.description,
      dueDate: zugferdInvoice.paymentTerms?.dueDate || zugferdInvoice.dueDate,
      meansCode: zugferdInvoice.paymentMeansCode,
      iban: zugferdInvoice.payeeIban,
      bic: zugferdInvoice.payeeBic,
      accountName: zugferdInvoice.payeeAccountName,
      mandateId: zugferdInvoice.paymentTerms?.directDebitMandateId,
    },
    references: {
      orderReference: zugferdInvoice.orderReference,
      contractReference: zugferdInvoice.contractReference,
      projectReference: zugferdInvoice.projectReference,
    },
    delivery: { date: zugferdInvoice.deliveryDate },
    notes: zugferdInvoice.notes,
  };
}

export function validateRequiredFields(invoice: Invoice): {
  valid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];
  if (!invoice.number) missingFields.push('number');
  if (!invoice.supplier?.name) missingFields.push('supplier.name');
  if (!invoice.customer?.name) missingFields.push('customer.name');
  if (!invoice.totals?.currency) missingFields.push('totals.currency');
  return { valid: missingFields.length === 0, missingFields };
}
