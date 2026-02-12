/**
 * GoBD Prisma Adapter
 */

import type { Invoice, InvoiceLineItem } from '@/src/generated/prisma/client';
import type { GoBDComplianceStatus as PrismaGoBDStatus } from '@/src/generated/prisma/client';
import { InvoiceData, LineItemData } from './types';
import type { GoBDComplianceStatus } from './constants';

export function mapPrismaInvoiceToGoBD(
  invoice: Invoice & { lineItems?: InvoiceLineItem[] }
): InvoiceData {
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

export function mapPrismaLineItemToGoBD(
  lineItem: InvoiceLineItem
): LineItemData {
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

/**
 * Map GoBD compliance status to Prisma enum
 */
export function mapGoBDStatusToPrisma(
  status: GoBDComplianceStatus
): PrismaGoBDStatus {
  switch (status) {
    case 'compliant':
      return 'COMPLIANT';
    case 'non-compliant':
      return 'NON_COMPLIANT';
    case 'warning':
      return 'WARNING';
    default:
      return 'NON_COMPLIANT';
  }
}

/**
 * Map Prisma GoBD status to GoBD compliance status
 */
export function mapPrismaStatusToGoBD(
  status: PrismaGoBDStatus | null
): GoBDComplianceStatus | null {
  switch (status) {
    case 'COMPLIANT':
      return 'compliant';
    case 'NON_COMPLIANT':
      return 'non-compliant';
    case 'WARNING':
      return 'warning';
    default:
      return null;
  }
}
