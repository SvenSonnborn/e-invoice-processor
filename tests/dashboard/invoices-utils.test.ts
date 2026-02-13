import { describe, expect, it } from 'bun:test';
import {
  aggregateDashboardStatusDistribution,
  coerceGrossAmountToNumber,
  getInvoiceStatusesForDashboardGroup,
  isDashboardStatusGroup,
  mapInvoiceStatusToDashboardGroup,
  startOfCurrentMonthInServerTimezone,
} from '@/src/lib/dashboard/invoices';

describe('dashboard invoice helpers', () => {
  it('maps UI groups to invoice statuses', () => {
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
    expect(getInvoiceStatusesForDashboardGroup(undefined)).toBeUndefined();
  });

  it('validates status group values', () => {
    expect(isDashboardStatusGroup('uploaded')).toBe(true);
    expect(isDashboardStatusGroup('processed')).toBe(true);
    expect(isDashboardStatusGroup('exported')).toBe(true);
    expect(isDashboardStatusGroup('failed')).toBe(false);
    expect(isDashboardStatusGroup(undefined)).toBe(false);
  });

  it('aggregates raw status distribution into dashboard groups', () => {
    const distribution = aggregateDashboardStatusDistribution([
      { status: 'UPLOADED', _count: { _all: 2 } },
      { status: 'CREATED', _count: { _all: 1 } },
      { status: 'PARSED', _count: { _all: 3 } },
      { status: 'VALIDATED', _count: { _all: 2 } },
      { status: 'EXPORTED', _count: { _all: 4 } },
      { status: 'FAILED', _count: { _all: 9 } },
    ]);

    expect(distribution).toEqual({
      uploaded: 3,
      processed: 5,
      exported: 4,
    });
  });

  it('coerces gross amount values null-safely', () => {
    expect(coerceGrossAmountToNumber(null)).toBe(0);
    expect(coerceGrossAmountToNumber(undefined)).toBe(0);
    expect(coerceGrossAmountToNumber(123.45)).toBe(123.45);
    expect(coerceGrossAmountToNumber('456.78')).toBe(456.78);
    expect(coerceGrossAmountToNumber('not-a-number')).toBe(0);
    expect(coerceGrossAmountToNumber({ toNumber: () => 42.5 })).toBe(42.5);
    expect(coerceGrossAmountToNumber({ toNumber: () => Number.NaN })).toBe(0);
  });

  it('maps invoice statuses to dashboard groups', () => {
    expect(mapInvoiceStatusToDashboardGroup('UPLOADED')).toBe('uploaded');
    expect(mapInvoiceStatusToDashboardGroup('CREATED')).toBe('uploaded');
    expect(mapInvoiceStatusToDashboardGroup('PARSED')).toBe('processed');
    expect(mapInvoiceStatusToDashboardGroup('VALIDATED')).toBe('processed');
    expect(mapInvoiceStatusToDashboardGroup('EXPORTED')).toBe('exported');
    expect(mapInvoiceStatusToDashboardGroup('FAILED')).toBeNull();
  });

  it('uses UTC month boundary for currentMonthCount calculations', () => {
    const referenceDate = new Date('2026-02-12T20:15:00.000Z');
    const monthStart = startOfCurrentMonthInServerTimezone(referenceDate);

    expect(monthStart.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});
