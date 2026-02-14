import { prisma } from '@/src/lib/db/client';
import { isPrismaUniqueConstraintError } from '@/src/lib/db/prisma-errors';
import type { InvoiceStatus, Prisma } from '@/src/generated/prisma/client';
import type { InvoiceParseResult } from '@/src/lib/zugferd/parser';

export interface PersistParsedInvoiceParams {
  organizationId: string;
  userId: string;
  parseResult: InvoiceParseResult;
  source: {
    filename?: string;
    mode: 'multipart' | 'json';
  };
}

export interface PersistParsedInvoiceResult {
  invoiceId: string;
  action: 'created' | 'updated';
  status: InvoiceStatus;
  number: string | null;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let normalized = trimmed;
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+(,\d+)$/.test(normalized)) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function normalizeCurrency(value: string | undefined): string {
  const normalized = value?.trim().toUpperCase();
  if (normalized && normalized.length === 3) return normalized;
  return 'EUR';
}

function normalizeNumber(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized;
}

function mapLineItems(parseResult: InvoiceParseResult): Array<{
  positionIndex: number;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  grossAmount: number | null;
}> {
  const lineItems = parseResult.extendedData?.lineItems ?? [];

  return lineItems.map((item, index) => ({
    positionIndex: index + 1,
    description: item.description ?? item.name ?? null,
    quantity: parseAmount(item.quantity) ?? null,
    unitPrice: parseAmount(item.unitPrice) ?? null,
    grossAmount: parseAmount(item.totalAmount) ?? null,
  }));
}

function buildInvoiceData(
  parseResult: InvoiceParseResult,
  now: Date
): {
  format: 'ZUGFERD' | 'XRECHNUNG' | 'UNKNOWN';
  number: string | null;
  supplierName: string | null;
  customerName: string | null;
  issueDate: Date | undefined;
  dueDate: Date | undefined;
  currency: string;
  taxId: string | null;
  netAmount: number | undefined;
  taxAmount: number | undefined;
  grossAmount: number | undefined;
  rawJson: Prisma.InputJsonValue;
} {
  const invoice = parseResult.invoice;
  if (!invoice) {
    throw new Error('Cannot persist parse result without invoice payload');
  }

  return {
    format: invoice.format,
    number: normalizeNumber(invoice.number),
    supplierName: invoice.supplier?.name ?? null,
    customerName: invoice.customer?.name ?? null,
    issueDate: parseDate(invoice.issueDate),
    dueDate: parseDate(invoice.dueDate),
    currency: normalizeCurrency(invoice.totals?.currency),
    taxId: parseResult.extendedData?.supplierDetails?.vatId ?? null,
    netAmount: parseAmount(invoice.totals?.netAmount),
    taxAmount: parseAmount(invoice.totals?.taxAmount),
    grossAmount: parseAmount(invoice.totals?.grossAmount),
    rawJson: toPrismaJson({
      importedAt: now.toISOString(),
      parseResult: {
        detection: parseResult.detection,
        validation: parseResult.validation,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
      },
      invoice,
      extendedData: parseResult.extendedData,
      rawData: parseResult.rawData,
    }),
  };
}

async function replaceInvoiceLineItems(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  parseResult: InvoiceParseResult
) {
  const lineItems = mapLineItems(parseResult);

  await tx.invoiceLineItem.deleteMany({
    where: { invoiceId },
  });

  if (lineItems.length === 0) return;

  await tx.invoiceLineItem.createMany({
    data: lineItems.map((item) => ({
      invoiceId,
      ...item,
    })),
  });
}

export async function persistParsedInvoice(
  params: PersistParsedInvoiceParams
): Promise<PersistParsedInvoiceResult> {
  const { organizationId, userId, parseResult, source } = params;

  if (!parseResult.success || !parseResult.invoice) {
    throw new Error('Only successful parse results can be persisted');
  }

  const normalizedNumber = normalizeNumber(parseResult.invoice.number);
  const now = new Date();
  const baseData = buildInvoiceData(parseResult, now);

  return prisma.$transaction(async (tx) => {
    const updateExisting = async (
      existing: Pick<{ id: string; status: InvoiceStatus }, 'id' | 'status'>
    ): Promise<PersistParsedInvoiceResult> => {
      const updated = await tx.invoice.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          status: existing.status === 'EXPORTED' ? 'EXPORTED' : 'VALIDATED',
          lastProcessedAt: now,
          processingVersion: { increment: 1 },
        },
        select: {
          id: true,
          status: true,
          number: true,
        },
      });

      await replaceInvoiceLineItems(tx, updated.id, parseResult);

      return {
        invoiceId: updated.id,
        action: 'updated',
        status: updated.status,
        number: updated.number,
      };
    };

    if (normalizedNumber) {
      const existing = await tx.invoice.findFirst({
        where: {
          organizationId,
          number: normalizedNumber,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (existing) return updateExisting(existing);
    }

    try {
      const created = await tx.invoice.create({
        data: {
          organizationId,
          createdBy: userId,
          status: 'VALIDATED',
          lastProcessedAt: now,
          ...baseData,
          rawJson: toPrismaJson({
            ...(baseData.rawJson as Record<string, unknown>),
            importContext: source,
          }),
        },
        select: {
          id: true,
          status: true,
          number: true,
        },
      });

      await replaceInvoiceLineItems(tx, created.id, parseResult);

      return {
        invoiceId: created.id,
        action: 'created',
        status: created.status,
        number: created.number,
      };
    } catch (error) {
      if (
        normalizedNumber &&
        (isPrismaUniqueConstraintError(error, ['organizationId', 'number']) ||
          isPrismaUniqueConstraintError(error, [
            'Invoice_organizationId_number_key',
          ]))
      ) {
        const existing = await tx.invoice.findFirst({
          where: {
            organizationId,
            number: normalizedNumber,
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (existing) return updateExisting(existing);
      }

      throw error;
    }
  });
}
