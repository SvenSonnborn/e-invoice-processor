import { describe, expect, it } from 'bun:test';
import {
  aggregateDashboardStatusDistribution,
  coerceGrossAmountToNumber,
  getInvoiceStatusesForDashboardGroup,
  mapInvoiceStatusToDashboardGroup,
  startOfCurrentMonthInServerTimezone,
} from '@/src/lib/dashboard/invoices';

describe('dashboard invoice helpers', () => {
  it('maps UI status groups to Prisma statuses', () => {
    expect(getInvoiceStatusesForDashboardGroup('uploaded')).toEqual([
      'UPLOADED',
      'CREATED',
    ]);
    expect(getInvoiceStatusesForDashboardGroup('processed')).toEqual([
      'PARSED',
      'VALIDATED',
    ]);
    expect(getInvoiceStatusesForDashboardGroup('exported')).toEqual([
      'EXPORTED',
    ]);
  });

  it('maps Prisma status to dashboard groups', () => {
    expect(mapInvoiceStatusToDashboardGroup('UPLOADED')).toBe('uploaded');
    expect(mapInvoiceStatusToDashboardGroup('CREATED')).toBe('uploaded');
    expect(mapInvoiceStatusToDashboardGroup('PARSED')).toBe('processed');
    expect(mapInvoiceStatusToDashboardGroup('VALIDATED')).toBe('processed');
    expect(mapInvoiceStatusToDashboardGroup('EXPORTED')).toBe('exported');
    expect(mapInvoiceStatusToDashboardGroup('FAILED')).toBeNull();
  });

  it('aggregates status distribution from raw invoice status counts', () => {
    const distribution = aggregateDashboardStatusDistribution([
      { status: 'UPLOADED', _count: { _all: 2 } },
      { status: 'CREATED', _count: { _all: 3 } },
      { status: 'PARSED', _count: { _all: 4 } },
      { status: 'VALIDATED', _count: { _all: 1 } },
      { status: 'EXPORTED', _count: { _all: 5 } },
      { status: 'FAILED', _count: { _all: 99 } },
    ]);

    expect(distribution).toEqual({
      uploaded: 5,
      processed: 5,
      exported: 5,
    });
  });

  it('coerces gross amount values to safe numbers', () => {
    expect(coerceGrossAmountToNumber(null)).toBe(0);
    expect(coerceGrossAmountToNumber(undefined)).toBe(0);
    expect(coerceGrossAmountToNumber(12.34)).toBe(12.34);
    expect(coerceGrossAmountToNumber('56.78')).toBe(56.78);
    expect(
      coerceGrossAmountToNumber({
        toNumber: () => 90.12,
      })
    ).toBe(90.12);
    expect(coerceGrossAmountToNumber('not-a-number')).toBe(0);
  });

  it('returns first day of the month in server timezone', () => {
    const start = startOfCurrentMonthInServerTimezone(
      new Date('2026-02-19T22:45:10.999Z')
    );

    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });
});
