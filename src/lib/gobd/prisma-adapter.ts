import type { Invoice, InvoiceLineItem } from '@prisma/client';
import { InvoiceData, LineItemData } from './types';

export function mapPrismaInvoiceToGoBD(invoice: Invoice & { lineItems?: InvoiceLineItem[] }): InvoiceData {
  return { id: invoice.id, number: invoice.number, issueDate: invoice.issueDate, dueDate: invoice.dueDate, supplierName: invoice.supplierName, customerName: invoice.customerName, currency: invoice.currency, netAmount: invoice.netAmount?.toNumber() ?? null, taxAmount: invoice.taxAmount?.toNumber() ?? null, grossAmount: invoice.grossAmount?.toNumber() ?? null, lineItems: invoice.lineItems?.map(mapPrismaLineItemToGoBD) ?? [] };
}
export function mapPrismaLineItemToGoBD(item: InvoiceLineItem): LineItemData {
  return { id: item.id, positionIndex: item.positionIndex, description: item.description, quantity: item.quantity?.toNumber() ?? null, unitPrice: item.unitPrice?.toNumber() ?? null, taxRate: item.taxRate?.toNumber() ?? null, netAmount: item.netAmount?.toNumber() ?? null, taxAmount: item.taxAmount?.toNumber() ?? null, grossAmount: item.grossAmount?.toNumber() ?? null };
}
