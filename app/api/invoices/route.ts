import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';
import { prisma } from '@/src/lib/db/client';
import type { Prisma } from '@/src/generated/prisma/client';
import {
  aggregateDashboardStatusDistribution,
  coerceGrossAmountToNumber,
  getInvoiceStatusesForDashboardGroup,
  isDashboardStatusGroup,
  startOfCurrentMonthInServerTimezone,
} from '@/src/lib/dashboard/invoices';
import type { DashboardInvoicesResponse } from '@/src/lib/dashboard/contracts';

const listInvoicesQuerySchema = z.object({
  statusGroup: z.string().optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await getMyOrganizationIdOrThrow();
    const { searchParams } = new URL(request.url);
    const parsedQuery = listInvoicesQuerySchema.safeParse({
      statusGroup: searchParams.get('statusGroup') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsedQuery.success) {
      throw ApiError.validationError('Invalid query parameters', {
        issues: parsedQuery.error.format(),
      });
    }

    const { statusGroup: rawStatusGroup, q, limit, cursor } = parsedQuery.data;
    if (
      rawStatusGroup !== undefined &&
      !isDashboardStatusGroup(rawStatusGroup)
    ) {
      throw ApiError.validationError(
        'statusGroup must be one of uploaded, processed, exported'
      );
    }

    const statusGroup = rawStatusGroup;
    const statuses = getInvoiceStatusesForDashboardGroup(statusGroup);
    const normalizedQuery = q && q.length > 0 ? q : undefined;

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      ...(statuses ? { status: { in: [...statuses] } } : {}),
      ...(normalizedQuery
        ? {
            OR: [
              { number: { contains: normalizedQuery, mode: 'insensitive' } },
              {
                supplierName: {
                  contains: normalizedQuery,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const monthStart = startOfCurrentMonthInServerTimezone();

    const [invoiceRows, totalCount, currentMonthCount, grossAmountAggregate, rawStatusCounts] =
      await Promise.all([
        prisma.invoice.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            number: true,
            supplierName: true,
            status: true,
            grossAmount: true,
            createdAt: true,
            issueDate: true,
          },
        }),
        prisma.invoice.count({ where }),
        prisma.invoice.count({
          where: {
            ...where,
            createdAt: {
              gte: monthStart,
            },
          },
        }),
        prisma.invoice.aggregate({
          where,
          _sum: {
            grossAmount: true,
          },
        }),
        prisma.invoice.groupBy({
          by: ['status'],
          where,
          _count: {
            _all: true,
          },
        }),
      ]);

    const hasMore = invoiceRows.length > limit;
    const paginatedRows = hasMore ? invoiceRows.slice(0, limit) : invoiceRows;
    const nextCursor = hasMore ? paginatedRows[paginatedRows.length - 1].id : null;
    const statusDistribution = aggregateDashboardStatusDistribution(rawStatusCounts);
    const totalGrossAmount = coerceGrossAmountToNumber(
      grossAmountAggregate._sum.grossAmount
    );

    const response: DashboardInvoicesResponse = {
      success: true,
      items: paginatedRows.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        supplierName: invoice.supplierName,
        status: invoice.status,
        grossAmount:
          invoice.grossAmount === null
            ? null
            : coerceGrossAmountToNumber(invoice.grossAmount),
        createdAt: invoice.createdAt.toISOString(),
        issueDate: invoice.issueDate?.toISOString() ?? null,
      })),
      nextCursor,
      stats: {
        totalCount,
        currentMonthCount,
        totalGrossAmount,
        statusDistribution,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to list invoices');
    return ApiError.internal().toResponse();
  }
}

export async function POST() {
  try {
    await getMyOrganizationIdOrThrow();

    return NextResponse.json(
      { success: true, message: 'Create invoice - coming soon' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to create invoice');
    return ApiError.internal().toResponse();
  }
}
