import { describe, expect, it } from 'bun:test';
import {
  getInvoiceStatusesForApiStatusGroup,
  isApiInvoiceStatusGroup,
  isValidStatusTransition,
  mapInvoiceStatusToApiStatusGroup,
} from '@/src/lib/invoices/status';

describe('invoice status transitions', () => {
  it('allows re-processing transitions back to PARSED', () => {
    expect(isValidStatusTransition('PARSED', 'PARSED')).toBe(true);
    expect(isValidStatusTransition('VALIDATED', 'PARSED')).toBe(true);
    expect(isValidStatusTransition('EXPORTED', 'PARSED')).toBe(true);
    expect(isValidStatusTransition('FAILED', 'PARSED')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(isValidStatusTransition('UPLOADED', 'VALIDATED')).toBe(false);
    expect(isValidStatusTransition('CREATED', 'EXPORTED')).toBe(false);
  });

  it('maps invoice statuses to api status groups', () => {
    expect(mapInvoiceStatusToApiStatusGroup('UPLOADED')).toBe('uploaded');
    expect(mapInvoiceStatusToApiStatusGroup('CREATED')).toBe('uploaded');
    expect(mapInvoiceStatusToApiStatusGroup('PARSED')).toBe('processing');
    expect(mapInvoiceStatusToApiStatusGroup('VALIDATED')).toBe('processed');
    expect(mapInvoiceStatusToApiStatusGroup('FAILED')).toBe('failed');
    expect(mapInvoiceStatusToApiStatusGroup('EXPORTED')).toBe('exported');
  });

  it('validates and resolves api status group filters', () => {
    expect(isApiInvoiceStatusGroup('processing')).toBe(true);
    expect(isApiInvoiceStatusGroup('failed')).toBe(true);
    expect(isApiInvoiceStatusGroup('invalid')).toBe(false);

    expect(getInvoiceStatusesForApiStatusGroup('uploaded')).toEqual([
      'UPLOADED',
      'CREATED',
    ]);
    expect(getInvoiceStatusesForApiStatusGroup('processing')).toEqual([
      'PARSED',
    ]);
    expect(getInvoiceStatusesForApiStatusGroup('processed')).toEqual([
      'VALIDATED',
    ]);
    expect(getInvoiceStatusesForApiStatusGroup('failed')).toEqual(['FAILED']);
    expect(getInvoiceStatusesForApiStatusGroup('exported')).toEqual([
      'EXPORTED',
    ]);
  });
});
