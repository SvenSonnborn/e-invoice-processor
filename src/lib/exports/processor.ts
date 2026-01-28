import { prisma } from '@/src/lib/db/client'
import type { Export, ExportStatus } from '@prisma/client'
import { isValidExportStatusTransition } from './status'

/**
 * Export Processor
 *
 * Functions for managing export processing lifecycle and status transitions.
 */

/**
 * Update export status with validation
 *
 * @param exportId - Export ID
 * @param newStatus - New status
 * @param errorMessage - Optional error message for FAILED status
 * @returns Updated export
 */
export async function updateExportStatus(
  exportId: string,
  newStatus: ExportStatus,
  errorMessage?: string
): Promise<Export> {
  const currentExport = await prisma.export.findUnique({
    where: { id: exportId },
    select: { status: true },
  })

  if (!currentExport) {
    throw new Error(`Export ${exportId} not found`)
  }

  // Validate status transition
  if (!isValidExportStatusTransition(currentExport.status, newStatus)) {
    throw new Error(
      `Invalid status transition from ${currentExport.status} to ${newStatus}`
    )
  }

  return await prisma.export.update({
    where: { id: exportId },
    data: {
      status: newStatus,
      errorMessage: newStatus === 'FAILED' ? errorMessage : null,
      updatedAt: new Date(),
    },
  })
}

/**
 * Mark export as generating
 *
 * @param exportId - Export ID
 * @returns Updated export
 */
export async function markAsGenerating(exportId: string): Promise<Export> {
  return await updateExportStatus(exportId, 'GENERATING')
}

/**
 * Mark export as ready
 *
 * @param exportId - Export ID
 * @param storageKey - Storage key where the export file is stored
 * @returns Updated export
 */
export async function markAsReady(
  exportId: string,
  storageKey: string
): Promise<Export> {
  const currentExport = await prisma.export.findUnique({
    where: { id: exportId },
    select: { status: true },
  })

  if (!currentExport) {
    throw new Error(`Export ${exportId} not found`)
  }

  // Validate status transition
  if (!isValidExportStatusTransition(currentExport.status, 'READY')) {
    throw new Error(
      `Invalid status transition from ${currentExport.status} to READY`
    )
  }

  // Atomically update both status and storageKey
  return await prisma.export.update({
    where: { id: exportId },
    data: {
      status: 'READY',
      storageKey,
      errorMessage: null,
      updatedAt: new Date(),
    },
  })
}

/**
 * Mark export as failed
 *
 * @param exportId - Export ID
 * @param errorMessage - Error message
 * @returns Updated export
 */
export async function markAsFailed(
  exportId: string,
  errorMessage: string
): Promise<Export> {
  return await updateExportStatus(exportId, 'FAILED', errorMessage)
}

/**
 * Retry a failed export
 *
 * @param exportId - Export ID
 * @returns Updated export
 */
export async function retryFailedExport(exportId: string): Promise<Export> {
  const currentExport = await prisma.export.findUnique({
    where: { id: exportId },
    select: { status: true },
  })

  if (!currentExport) {
    throw new Error(`Export ${exportId} not found`)
  }

  if (currentExport.status !== 'FAILED') {
    throw new Error(`Export must be in FAILED status to retry`)
  }

  return await prisma.export.update({
    where: { id: exportId },
    data: {
      status: 'CREATED',
      errorMessage: null,
      storageKey: null,
      updatedAt: new Date(),
    },
  })
}

/**
 * Get exports by status for an organization
 *
 * @param organizationId - Organization ID
 * @param status - Export status
 * @returns Exports with the given status
 */
export async function getExportsByStatus(
  organizationId: string,
  status: ExportStatus
): Promise<Export[]> {
  return await prisma.export.findMany({
    where: {
      organizationId,
      status,
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get export processing statistics for an organization
 *
 * @param organizationId - Organization ID
 * @returns Export statistics
 */
export async function getExportStats(organizationId: string) {
  const [total, created, generating, ready, failed] = await Promise.all([
    prisma.export.count({ where: { organizationId } }),
    prisma.export.count({ where: { organizationId, status: 'CREATED' } }),
    prisma.export.count({ where: { organizationId, status: 'GENERATING' } }),
    prisma.export.count({ where: { organizationId, status: 'READY' } }),
    prisma.export.count({ where: { organizationId, status: 'FAILED' } }),
  ])

  return {
    total,
    byStatus: {
      CREATED: created,
      GENERATING: generating,
      READY: ready,
      FAILED: failed,
    },
    successRate: total > 0 ? ((ready / total) * 100).toFixed(2) : '0.00',
  }
}

/**
 * Get pending exports (CREATED status) ready for processing
 *
 * @param organizationId - Organization ID (optional)
 * @param limit - Maximum number of exports to return
 * @returns Pending exports
 */
export async function getPendingExports(
  organizationId?: string,
  limit: number = 100
): Promise<Export[]> {
  return await prisma.export.findMany({
    where: {
      ...(organizationId && { organizationId }),
      status: 'CREATED',
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}

/**
 * Get stuck exports (GENERATING for more than X minutes)
 *
 * @param minutesThreshold - Minutes threshold for stuck detection
 * @returns Stuck exports
 */
export async function getStuckExports(minutesThreshold: number = 30): Promise<Export[]> {
  const thresholdTime = new Date(Date.now() - minutesThreshold * 60 * 1000)

  return await prisma.export.findMany({
    where: {
      status: 'GENERATING',
      updatedAt: {
        lt: thresholdTime,
      },
    },
    orderBy: { updatedAt: 'asc' },
  })
}

/**
 * Mark stuck exports as failed
 *
 * @param minutesThreshold - Minutes threshold for stuck detection
 * @returns Number of exports marked as failed
 */
export async function failStuckExports(minutesThreshold: number = 30): Promise<number> {
  const stuckExports = await getStuckExports(minutesThreshold)

  for (const exp of stuckExports) {
    await markAsFailed(
      exp.id,
      `Export wurde nach ${minutesThreshold} Minuten automatisch als fehlgeschlagen markiert`
    )
  }

  return stuckExports.length
}

/**
 * Create a new export with actor tracking
 *
 * @param data - Export data
 * @param userId - User ID who creates the export
 * @returns Created export
 */
export async function createExport(
  data: {
    organizationId: string
    format: 'CSV' | 'DATEV'
    filename: string
    invoiceIds: string[]
  },
  userId: string
): Promise<Export> {
  return await prisma.$transaction(async (tx) => {
    // Create export
    const exp = await tx.export.create({
      data: {
        organizationId: data.organizationId,
        createdBy: userId,
        format: data.format,
        filename: data.filename,
        status: 'CREATED',
      },
    })

    // Link invoices
    await tx.exportInvoice.createMany({
      data: data.invoiceIds.map((invoiceId) => ({
        exportId: exp.id,
        invoiceId,
      })),
    })

    return exp
  })
}
