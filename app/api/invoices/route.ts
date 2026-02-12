import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';
import { prisma } from '@/src/lib/db/client';
import type { InvoiceStatus, Prisma } from '@/src/generated/prisma/client';
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
  status: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
  search: z.string().trim().max(120).optional(),
  issueDateFrom: z.string().datetime().optional(),
  issueDateTo: z.string().datetime().optional(),
  grossAmountMin: z.coerce.number().min(0).optional(),
  grossAmountMax: z.coerce.number().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await getMyOrganizationIdOrThrow();
    const { searchParams } = new URL(request.url);
    const parsedQuery = listInvoicesQuerySchema.safeParse({
      statusGroup: searchParams.get('statusGroup') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      issueDateFrom: searchParams.get('issueDateFrom') ?? undefined,
      issueDateTo: searchParams.get('issueDateTo') ?? undefined,
      grossAmountMin: searchParams.get('grossAmountMin') ?? undefined,
      grossAmountMax: searchParams.get('grossAmountMax') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!parsedQuery.success) {
      throw ApiError.validationError('Invalid query parameters', {
        issues: parsedQuery.error.format(),
      });
    }

    const {
      statusGroup: rawStatusGroup,
      status: rawStatus,
      q,
      search,
      issueDateFrom,
      issueDateTo,
      grossAmountMin,
      grossAmountMax,
      limit,
      cursor,
      page,
      offset: rawOffset,
    } = parsedQuery.data;

    if (page !== undefined && cursor) {
      throw ApiError.validationError(
        'cursor pagination cannot be combined with page pagination'
      );
    }
    if (rawOffset !== undefined && cursor) {
      throw ApiError.validationError(
        'cursor pagination cannot be combined with offset pagination'
      );
    }
    if (
      rawStatusGroup !== undefined &&
      !isDashboardStatusGroup(rawStatusGroup)
    ) {
      throw ApiError.validationError(
        'statusGroup must be one of uploaded, processed, exported'
      );
    }

    const statusGroupStatuses = getInvoiceStatusesForDashboardGroup(rawStatusGroup);
    const parsedStatuses = rawStatus
      ? rawStatus
          .split(',')
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean)
      : [];
    const statusesFromQuery = [...new Set(parsedStatuses)] as InvoiceStatus[];
    const validStatuses = new Set<InvoiceStatus>([
      'UPLOADED',
      'CREATED',
      'PARSED',
      'VALIDATED',
      'EXPORTED',
      'FAILED',
    ]);
    if (statusesFromQuery.some((status) => !validStatuses.has(status))) {
      throw ApiError.validationError(
        'status must be a comma-separated list of InvoiceStatus values'
      );
    }
    if (statusGroupStatuses && statusesFromQuery.length > 0) {
      throw ApiError.validationError(
        'statusGroup cannot be combined with status'
      );
    }
    if (
      grossAmountMin !== undefined &&
      grossAmountMax !== undefined &&
      grossAmountMin > grossAmountMax
    ) {
      throw ApiError.validationError(
        'grossAmountMin must be less than or equal to grossAmountMax'
      );
    }
    if (issueDateFrom && issueDateTo) {
      const from = new Date(issueDateFrom);
      const to = new Date(issueDateTo);
      if (from > to) {
        throw ApiError.validationError(
          'issueDateFrom must be less than or equal to issueDateTo'
        );
      }
    }

    const statuses =
      statusesFromQuery.length > 0 ? statusesFromQuery : statusGroupStatuses;
    const normalizedQuery = (search ?? q)?.trim() || undefined;
    const offset =
      rawOffset ?? (page !== undefined ? (page - 1) * limit : undefined);

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      ...(statuses ? { status: { in: [...statuses] } } : {}),
      ...(issueDateFrom || issueDateTo
        ? {
            issueDate: {
              ...(issueDateFrom ? { gte: new Date(issueDateFrom) } : {}),
              ...(issueDateTo ? { lte: new Date(issueDateTo) } : {}),
            },
          }
        : {}),
      ...(grossAmountMin !== undefined || grossAmountMax !== undefined
        ? {
            grossAmount: {
              ...(grossAmountMin !== undefined ? { gte: grossAmountMin } : {}),
              ...(grossAmountMax !== undefined ? { lte: grossAmountMax } : {}),
            },
          }
        : {}),
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
              {
                customerName: {
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
          ...(offset !== undefined ? { skip: offset } : {}),
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
    const effectiveOffset = offset ?? 0;
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
      pagination: {
        limit,
        offset: effectiveOffset,
        page: page ?? Math.floor(effectiveOffset / limit) + 1,
        hasMore,
      },
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
