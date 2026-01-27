import { prisma } from '@/src/lib/db/client'
import type { InvoiceStatus } from '@prisma/client'
import { isValidStatusTransition } from './status'
import { createRevision, CURRENT_PROCESSOR_VERSION } from './revisions'

/**
 * Invoice Processor Utilities
 *
 * Functions for updating invoice processing status and tracking.
 * Automatically creates revisions when rawJson changes.
 */

export interface UpdateStatusParams {
  invoiceId: string
  newStatus: InvoiceStatus
  error?: string
}

/**
 * Update invoice status with validation and tracking
 *
 * @throws Error if status transition is invalid
 */
export async function updateInvoiceStatus({
  invoiceId,
  newStatus,
  error,
}: UpdateStatusParams) {
  // Get current invoice
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, processingVersion: true },
  })

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`)
  }

  // Validate status transition
  if (!isValidStatusTransition(invoice.status, newStatus)) {
    throw new Error(
      `Invalid status transition: ${invoice.status} -> ${newStatus}`
    )
  }

  // Update invoice
  return await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: newStatus,
      lastProcessedAt: new Date(),
      processingVersion: invoice.processingVersion + 1,
      // If failed, store error in a separate error log (you might add an errors relation)
    },
  })
}

/**
 * Mark invoice as parsed (step 1)
 * Automatically creates a revision with the parsed data
 */
export async function markAsParsed(
  invoiceId: string,
  rawData: unknown,
  processorVersion: string = CURRENT_PROCESSOR_VERSION
) {
  return await prisma.$transaction(async (tx) => {
    // Create revision
    await tx.invoiceRevision.create({
      data: {
        invoiceId,
        rawJson: rawData as any,
        processorVersion,
      },
    })

    // Update invoice
    return await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PARSED',
        rawJson: rawData as any,
        lastProcessedAt: new Date(),
        processingVersion: { increment: 1 },
      },
    })
  })
}

/**
 * Mark invoice as validated (step 2)
 */
export async function markAsValidated(
  invoiceId: string,
  validatedData: {
    number?: string
    supplierName?: string
    customerName?: string
    issueDate?: Date
    dueDate?: Date
    netAmount?: number
    taxAmount?: number
    grossAmount?: number
  }
) {
  return await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'VALIDATED',
      ...validatedData,
      lastProcessedAt: new Date(),
      processingVersion: { increment: 1 },
    },
  })
}

/**
 * Mark invoice as exported (step 3)
 */
export async function markAsExported(invoiceId: string) {
  return await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'EXPORTED',
      lastProcessedAt: new Date(),
      processingVersion: { increment: 1 },
    },
  })
}

/**
 * Mark invoice as failed
 */
export async function markAsFailed(invoiceId: string, errorMessage: string) {
  return await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'FAILED',
      lastProcessedAt: new Date(),
      processingVersion: { increment: 1 },
      // Store error message somewhere (you might want to add an errorMessage field)
    },
  })
}

/**
 * Retry a failed invoice (reset to CREATED)
 */
export async function retryFailedInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true },
  })

  if (invoice?.status !== 'FAILED') {
    throw new Error('Can only retry failed invoices')
  }

  return await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'CREATED',
      lastProcessedAt: new Date(),
      processingVersion: { increment: 1 },
    },
  })
}

/**
 * Get invoices by status
 */
export async function getInvoicesByStatus(
  organizationId: string,
  status: InvoiceStatus
) {
  return await prisma.invoice.findMany({
    where: {
      organizationId,
      status,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

/**
 * Get processing statistics for an organization
 */
export async function getProcessingStats(organizationId: string) {
  const [total, created, parsed, validated, exported, failed] = await Promise.all([
    prisma.invoice.count({ where: { organizationId } }),
    prisma.invoice.count({ where: { organizationId, status: 'CREATED' } }),
    prisma.invoice.count({ where: { organizationId, status: 'PARSED' } }),
    prisma.invoice.count({ where: { organizationId, status: 'VALIDATED' } }),
    prisma.invoice.count({ where: { organizationId, status: 'EXPORTED' } }),
    prisma.invoice.count({ where: { organizationId, status: 'FAILED' } }),
  ])

  return {
    total,
    byStatus: {
      CREATED: created,
      PARSED: parsed,
      VALIDATED: validated,
      EXPORTED: exported,
      FAILED: failed,
    },
    successRate: total > 0 ? (exported / total) * 100 : 0,
    failureRate: total > 0 ? (failed / total) * 100 : 0,
  }
}
