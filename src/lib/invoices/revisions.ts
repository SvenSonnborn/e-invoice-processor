import { prisma } from '@/src/lib/db/client';
import type { InvoiceRevision, Prisma } from '@/src/generated/prisma/client';

/**
 * Invoice Revision Management
 *
 * Functions for managing invoice processing revisions.
 * Each time an invoice is re-processed, a new revision is created.
 */

/**
 * Current processor version
 * Update this when parser logic changes
 */
export const CURRENT_PROCESSOR_VERSION = '1.0.0';

export interface CreateRevisionParams {
  invoiceId: string;
  rawJson: Prisma.InputJsonValue;
  processorVersion?: string;
}

export interface RevisionWithMetadata extends InvoiceRevision {
  isLatest: boolean;
  revisionNumber: number;
}

/**
 * Create a new revision and update invoice with latest data
 *
 * @param params - Revision creation parameters
 * @returns Created revision
 */
export async function createRevision({
  invoiceId,
  rawJson,
  processorVersion = CURRENT_PROCESSOR_VERSION,
}: CreateRevisionParams): Promise<InvoiceRevision> {
  return await prisma.$transaction(async (tx) => {
    // 1. Create new revision
    const revision = await tx.invoiceRevision.create({
      data: {
        invoiceId,
        rawJson,
        processorVersion,
      },
    });

    // 2. Update invoice with latest rawJson
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        rawJson,
        lastProcessedAt: new Date(),
        processingVersion: { increment: 1 },
      },
    });

    return revision;
  });
}

/**
 * Get all revisions for an invoice
 *
 * @param invoiceId - Invoice ID
 * @param options - Query options
 * @returns List of revisions ordered by creation date (newest first)
 */
export async function getRevisions(
  invoiceId: string,
  options: {
    limit?: number;
    offset?: number;
    processorVersion?: string;
  } = {}
): Promise<RevisionWithMetadata[]> {
  const { limit, offset = 0, processorVersion } = options;

  const [revisions, totalCount] = await Promise.all([
    prisma.invoiceRevision.findMany({
      where: {
        invoiceId,
        ...(processorVersion && { processorVersion }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.invoiceRevision.count({
      where: {
        invoiceId,
        ...(processorVersion && { processorVersion }),
      },
    }),
  ]);

  // Enrich with metadata relative to overall dataset
  return revisions.map((revision, index) => ({
    ...revision,
    isLatest: offset === 0 && index === 0,
    revisionNumber: totalCount - (offset + index),
  }));
}

/**
 * Get the latest revision for an invoice
 *
 * @param invoiceId - Invoice ID
 * @returns Latest revision or null
 */
export async function getLatestRevision(
  invoiceId: string
): Promise<InvoiceRevision | null> {
  return await prisma.invoiceRevision.findFirst({
    where: { invoiceId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a specific revision by ID
 *
 * @param revisionId - Revision ID
 * @returns Revision or null
 */
export async function getRevisionById(
  revisionId: string
): Promise<InvoiceRevision | null> {
  return await prisma.invoiceRevision.findUnique({
    where: { id: revisionId },
  });
}

/**
 * Count revisions for an invoice
 *
 * @param invoiceId - Invoice ID
 * @returns Revision count
 */
export async function countRevisions(invoiceId: string): Promise<number> {
  return await prisma.invoiceRevision.count({
    where: { invoiceId },
  });
}

/**
 * Revert invoice to a specific revision
 *
 * @param invoiceId - Invoice ID
 * @param revisionId - Revision ID to revert to
 * @returns Updated invoice
 */
export async function revertToRevision(invoiceId: string, revisionId: string) {
  const revision = await prisma.invoiceRevision.findUnique({
    where: { id: revisionId },
  });

  if (!revision) {
    throw new Error(`Revision ${revisionId} not found`);
  }

  if (revision.invoiceId !== invoiceId) {
    throw new Error(
      `Revision ${revisionId} does not belong to invoice ${invoiceId}`
    );
  }

  // Create a new revision from the old data
  return await createRevision({
    invoiceId,
    rawJson: revision.rawJson as Prisma.InputJsonValue,
    processorVersion: `${revision.processorVersion}-reverted`,
  });
}

/**
 * Compare two revisions
 *
 * @param revisionId1 - First revision ID
 * @param revisionId2 - Second revision ID
 * @returns Comparison object
 */
export async function compareRevisions(
  revisionId1: string,
  revisionId2: string
) {
  const [rev1, rev2] = await Promise.all([
    getRevisionById(revisionId1),
    getRevisionById(revisionId2),
  ]);

  if (!rev1 || !rev2) {
    throw new Error('One or both revisions not found');
  }

  return {
    revision1: {
      id: rev1.id,
      processorVersion: rev1.processorVersion,
      createdAt: rev1.createdAt,
      data: rev1.rawJson,
    },
    revision2: {
      id: rev2.id,
      processorVersion: rev2.processorVersion,
      createdAt: rev2.createdAt,
      data: rev2.rawJson,
    },
    processorVersionChanged: rev1.processorVersion !== rev2.processorVersion,
    timeDifference: Math.abs(
      rev2.createdAt.getTime() - rev1.createdAt.getTime()
    ),
  };
}

/**
 * Delete old revisions, keeping only the N most recent
 *
 * @param invoiceId - Invoice ID
 * @param keepCount - Number of revisions to keep (default: 10)
 * @returns Number of deleted revisions
 */
export async function pruneOldRevisions(
  invoiceId: string,
  keepCount: number = 10
): Promise<number> {
  // Get revisions to keep
  const revisionsToKeep = await prisma.invoiceRevision.findMany({
    where: { invoiceId },
    orderBy: { createdAt: 'desc' },
    take: keepCount,
    select: { id: true },
  });

  const keepIds = revisionsToKeep.map((r) => r.id);

  // Delete old revisions
  const result = await prisma.invoiceRevision.deleteMany({
    where: {
      invoiceId,
      id: { notIn: keepIds },
    },
  });

  return result.count;
}

/**
 * Get revision statistics
 *
 * @param invoiceId - Invoice ID
 * @returns Revision statistics
 */
export async function getRevisionStats(invoiceId: string) {
  const revisions = await prisma.invoiceRevision.findMany({
    where: { invoiceId },
    orderBy: { createdAt: 'asc' },
  });

  if (revisions.length === 0) {
    return {
      totalRevisions: 0,
      firstProcessedAt: null,
      lastProcessedAt: null,
      processorVersions: [],
      averageTimeBetweenRevisions: 0,
    };
  }

  const firstRevision = revisions[0];
  const lastRevision = revisions[revisions.length - 1];

  // Calculate average time between revisions
  let totalTimeDiff = 0;
  for (let i = 1; i < revisions.length; i++) {
    totalTimeDiff +=
      revisions[i].createdAt.getTime() - revisions[i - 1].createdAt.getTime();
  }
  const avgTime =
    revisions.length > 1 ? totalTimeDiff / (revisions.length - 1) : 0;

  // Get unique processor versions
  const processorVersions = Array.from(
    new Set(revisions.map((r) => r.processorVersion))
  );

  return {
    totalRevisions: revisions.length,
    firstProcessedAt: firstRevision.createdAt,
    lastProcessedAt: lastRevision.createdAt,
    processorVersions,
    averageTimeBetweenRevisions: avgTime,
  };
}

/**
 * Get invoices that need re-processing
 * (processed with old processor version)
 *
 * @param organizationId - Organization ID
 * @param currentVersion - Current processor version (default: CURRENT_PROCESSOR_VERSION)
 * @returns Invoices to re-process
 */
export async function getInvoicesNeedingReprocessing(
  organizationId: string,
  currentVersion: string = CURRENT_PROCESSOR_VERSION
) {
  // Get all invoices with their latest revision
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['PARSED', 'VALIDATED', 'EXPORTED'] }, // Only re-process successful ones
    },
    include: {
      revisions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  // Filter invoices where latest revision has old processor version
  return invoices.filter((invoice) => {
    const latestRevision = invoice.revisions[0];
    // Only include invoices that have been processed (have revisions)
    // AND were processed with an old version
    return latestRevision && latestRevision.processorVersion !== currentVersion;
  });
}

/**
 * Re-process an invoice with the current processor version
 *
 * @param invoiceId - Invoice ID
 * @param rawData - New raw data from re-processing
 * @returns Created revision
 */
export async function reprocessInvoice(
  invoiceId: string,
  rawData: Prisma.InputJsonValue
): Promise<InvoiceRevision> {
  return await createRevision({
    invoiceId,
    rawJson: rawData,
    processorVersion: CURRENT_PROCESSOR_VERSION,
  });
}
