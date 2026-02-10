/**
 * GoBD Prisma Adapter
 */

import type { Invoice, InvoiceLineItem } from '@/src/generated/prisma/client';
import { InvoiceData, LineItemData } from './types';

export function mapPrismaInvoiceToGoBD(invoice: Invoice & { lineItems?: InvoiceLineItem[] }): InvoiceData {
  return {
    id: invoice.id,
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    supplierName: invoice.supplierName,
    customerName: invoice.customerName,
    currency: invoice.currency,
    netAmount: invoice.netAmount?.toNumber() ?? null,
    taxAmount: invoice.taxAmount?.toNumber() ?? null,
    grossAmount: invoice.grossAmount?.toNumber() ?? null,
    lineItems: invoice.lineItems?.map(mapPrismaLineItemToGoBD) ?? [],
  };
}

export function mapPrismaLineItemToGoBD(lineItem: InvoiceLineItem): LineItemData {
  return {
    id: lineItem.id,
    positionIndex: lineItem.positionIndex,
    description: lineItem.description,
    quantity: lineItem.quantity?.toNumber() ?? null,
    unitPrice: lineItem.unitPrice?.toNumber() ?? null,
    taxRate: lineItem.taxRate?.toNumber() ?? null,
    netAmount: lineItem.netAmount?.toNumber() ?? null,
    taxAmount: lineItem.taxAmount?.toNumber() ?? null,
    grossAmount: lineItem.grossAmount?.toNumber() ?? null,
  };
}
