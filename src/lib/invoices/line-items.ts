import { prisma } from '@/src/lib/db/client'
import type { InvoiceLineItem } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * Invoice Line Items Utilities
 *
 * Functions for managing invoice line items (positions).
 */

export interface LineItemInput {
  positionIndex: number
  description?: string | null
  quantity?: number | null
  unitPrice?: number | null
  taxRate?: number | null
  netAmount?: number | null
  taxAmount?: number | null
  grossAmount?: number | null
}

export interface LineItemCalculation {
  quantity: number
  unitPrice: number
  taxRate: number
  netAmount: number
  taxAmount: number
  grossAmount: number
}

/**
 * Create line items for an invoice
 *
 * @param invoiceId - Invoice ID
 * @param items - Array of line items
 * @returns Created line items
 */
export async function createLineItems(
  invoiceId: string,
  items: LineItemInput[]
): Promise<InvoiceLineItem[]> {
  // Validate unique position indices
  const indices = items.map((item) => item.positionIndex)
  const uniqueIndices = new Set(indices)

  if (indices.length !== uniqueIndices.size) {
    throw new Error('Duplicate position indices found')
  }

  // Create all line items
  const created = await Promise.all(
    items.map((item) =>
      prisma.invoiceLineItem.create({
        data: {
          invoiceId,
          positionIndex: item.positionIndex,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          netAmount: item.netAmount,
          taxAmount: item.taxAmount,
          grossAmount: item.grossAmount,
        },
      })
    )
  )

  return created
}

/**
 * Replace all line items for an invoice
 *
 * @param invoiceId - Invoice ID
 * @param items - New line items
 * @returns Created line items
 */
export async function replaceLineItems(
  invoiceId: string,
  items: LineItemInput[]
): Promise<InvoiceLineItem[]> {
  return await prisma.$transaction(async (tx) => {
    // Delete existing line items
    await tx.invoiceLineItem.deleteMany({
      where: { invoiceId },
    })

    // Create new line items
    const created = await Promise.all(
      items.map((item) =>
        tx.invoiceLineItem.create({
          data: {
            invoiceId,
            positionIndex: item.positionIndex,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            netAmount: item.netAmount,
            taxAmount: item.taxAmount,
            grossAmount: item.grossAmount,
          },
        })
      )
    )

    return created
  })
}

/**
 * Get line items for an invoice
 *
 * @param invoiceId - Invoice ID
 * @returns Line items ordered by position index
 */
export async function getLineItems(
  invoiceId: string
): Promise<InvoiceLineItem[]> {
  return await prisma.invoiceLineItem.findMany({
    where: { invoiceId },
    orderBy: { positionIndex: 'asc' },
  })
}

/**
 * Update a single line item
 *
 * @param lineItemId - Line item ID
 * @param data - Updated data
 * @returns Updated line item
 */
export async function updateLineItem(
  lineItemId: string,
  data: Partial<LineItemInput>
): Promise<InvoiceLineItem> {
  return await prisma.invoiceLineItem.update({
    where: { id: lineItemId },
    data,
  })
}

/**
 * Delete a line item
 *
 * @param lineItemId - Line item ID
 */
export async function deleteLineItem(lineItemId: string): Promise<void> {
  await prisma.invoiceLineItem.delete({
    where: { id: lineItemId },
  })
}

/**
 * Delete all line items for an invoice
 *
 * @param invoiceId - Invoice ID
 * @returns Number of deleted items
 */
export async function deleteAllLineItems(invoiceId: string): Promise<number> {
  const result = await prisma.invoiceLineItem.deleteMany({
    where: { invoiceId },
  })

  return result.count
}

/**
 * Calculate line item amounts from quantity, unitPrice, and taxRate
 *
 * @param quantity - Quantity
 * @param unitPrice - Unit price (net)
 * @param taxRate - Tax rate (e.g., 19 for 19%)
 * @returns Calculated amounts
 */
export function calculateLineItem(
  quantity: number,
  unitPrice: number,
  taxRate: number
): LineItemCalculation {
  const netAmount = quantity * unitPrice
  const taxAmount = (netAmount * taxRate) / 100
  const grossAmount = netAmount + taxAmount

  return {
    quantity,
    unitPrice,
    taxRate,
    netAmount: Number(netAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    grossAmount: Number(grossAmount.toFixed(2)),
  }
}

/**
 * Validate line item calculations
 *
 * @param item - Line item to validate
 * @returns Validation result
 */
export function validateLineItem(item: LineItemInput): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check required fields for calculation
  if (
    item.quantity !== null &&
    item.quantity !== undefined &&
    item.unitPrice !== null &&
    item.unitPrice !== undefined &&
    item.taxRate !== null &&
    item.taxRate !== undefined
  ) {
    const calculated = calculateLineItem(item.quantity, item.unitPrice, item.taxRate)

    // Validate netAmount
    if (item.netAmount !== null && item.netAmount !== undefined) {
      const diff = Math.abs(calculated.netAmount - item.netAmount)
      if (diff > 0.01) {
        errors.push(
          `Net amount mismatch: expected ${calculated.netAmount}, got ${item.netAmount}`
        )
      }
    }

    // Validate taxAmount
    if (item.taxAmount !== null && item.taxAmount !== undefined) {
      const diff = Math.abs(calculated.taxAmount - item.taxAmount)
      if (diff > 0.01) {
        errors.push(
          `Tax amount mismatch: expected ${calculated.taxAmount}, got ${item.taxAmount}`
        )
      }
    }

    // Validate grossAmount
    if (item.grossAmount !== null && item.grossAmount !== undefined) {
      const diff = Math.abs(calculated.grossAmount - item.grossAmount)
      if (diff > 0.01) {
        errors.push(
          `Gross amount mismatch: expected ${calculated.grossAmount}, got ${item.grossAmount}`
        )
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate invoice totals from line items
 *
 * @param items - Line items
 * @returns Invoice totals
 */
export function calculateInvoiceTotals(items: LineItemInput[]): {
  netAmount: number
  taxAmount: number
  grossAmount: number
  lineCount: number
} {
  let totalNet = 0
  let totalTax = 0
  let totalGross = 0

  for (const item of items) {
    if (item.netAmount !== null && item.netAmount !== undefined) {
      totalNet += item.netAmount
    }
    if (item.taxAmount !== null && item.taxAmount !== undefined) {
      totalTax += item.taxAmount
    }
    if (item.grossAmount !== null && item.grossAmount !== undefined) {
      totalGross += item.grossAmount
    }
  }

  return {
    netAmount: Number(totalNet.toFixed(2)),
    taxAmount: Number(totalTax.toFixed(2)),
    grossAmount: Number(totalGross.toFixed(2)),
    lineCount: items.length,
  }
}

/**
 * Validate that invoice totals match sum of line items
 *
 * @param invoiceId - Invoice ID
 * @returns Validation result
 */
export async function validateInvoiceTotals(invoiceId: string): Promise<{
  valid: boolean
  errors: string[]
  details: {
    invoiceNetAmount: number | null
    invoiceTaxAmount: number | null
    invoiceGrossAmount: number | null
    lineItemsNetAmount: number
    lineItemsTaxAmount: number
    lineItemsGrossAmount: number
  }
}> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      netAmount: true,
      taxAmount: true,
      grossAmount: true,
      lineItems: true,
    },
  })

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`)
  }

  const lineItemTotals = calculateInvoiceTotals(
    invoice.lineItems.map((item) => ({
      positionIndex: item.positionIndex,
      netAmount: item.netAmount ? Number(item.netAmount) : null,
      taxAmount: item.taxAmount ? Number(item.taxAmount) : null,
      grossAmount: item.grossAmount ? Number(item.grossAmount) : null,
    }))
  )

  const errors: string[] = []

  // Compare net amounts
  if (invoice.netAmount !== null) {
    const invoiceNet = Number(invoice.netAmount)
    const diff = Math.abs(invoiceNet - lineItemTotals.netAmount)
    if (diff > 0.01) {
      errors.push(
        `Net amount mismatch: invoice ${invoiceNet}, line items ${lineItemTotals.netAmount}`
      )
    }
  }

  // Compare tax amounts
  if (invoice.taxAmount !== null) {
    const invoiceTax = Number(invoice.taxAmount)
    const diff = Math.abs(invoiceTax - lineItemTotals.taxAmount)
    if (diff > 0.01) {
      errors.push(
        `Tax amount mismatch: invoice ${invoiceTax}, line items ${lineItemTotals.taxAmount}`
      )
    }
  }

  // Compare gross amounts
  if (invoice.grossAmount !== null) {
    const invoiceGross = Number(invoice.grossAmount)
    const diff = Math.abs(invoiceGross - lineItemTotals.grossAmount)
    if (diff > 0.01) {
      errors.push(
        `Gross amount mismatch: invoice ${invoiceGross}, line items ${lineItemTotals.grossAmount}`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    details: {
      invoiceNetAmount: invoice.netAmount ? Number(invoice.netAmount) : null,
      invoiceTaxAmount: invoice.taxAmount ? Number(invoice.taxAmount) : null,
      invoiceGrossAmount: invoice.grossAmount ? Number(invoice.grossAmount) : null,
      lineItemsNetAmount: lineItemTotals.netAmount,
      lineItemsTaxAmount: lineItemTotals.taxAmount,
      lineItemsGrossAmount: lineItemTotals.grossAmount,
    },
  }
}

/**
 * Get line item statistics
 *
 * @param invoiceId - Invoice ID
 * @returns Line item statistics
 */
export async function getLineItemStats(invoiceId: string) {
  const items = await getLineItems(invoiceId)

  if (items.length === 0) {
    return {
      count: 0,
      totalNet: 0,
      totalTax: 0,
      totalGross: 0,
      averageNetAmount: 0,
      maxNetAmount: 0,
      minNetAmount: 0,
    }
  }

  const netAmounts = items
    .map((item) => (item.netAmount ? Number(item.netAmount) : 0))
    .filter((amount) => amount > 0)

  const totalNet = netAmounts.reduce((sum, amount) => sum + amount, 0)
  const totalTax = items
    .map((item) => (item.taxAmount ? Number(item.taxAmount) : 0))
    .reduce((sum, amount) => sum + amount, 0)
  const totalGross = items
    .map((item) => (item.grossAmount ? Number(item.grossAmount) : 0))
    .reduce((sum, amount) => sum + amount, 0)

  return {
    count: items.length,
    totalNet: Number(totalNet.toFixed(2)),
    totalTax: Number(totalTax.toFixed(2)),
    totalGross: Number(totalGross.toFixed(2)),
    averageNetAmount:
      netAmounts.length > 0
        ? Number((totalNet / netAmounts.length).toFixed(2))
        : 0,
    maxNetAmount: netAmounts.length > 0 ? Math.max(...netAmounts) : 0,
    minNetAmount: netAmounts.length > 0 ? Math.min(...netAmounts) : 0,
  }
}
