import { describe, it, expect } from 'bun:test';
import { validateGoBDCompliance, isGoBDCompliant, getComplianceStatusText, GOB_ERROR_CODES, GOB_WARNING_CODES } from '../../src/lib/gobd';

describe('GoBD', () => {
  const validInvoice = { id: 'inv-123', number: 'RE-001', issueDate: new Date('2024-01-15'), dueDate: new Date('2024-02-15'), supplierName: 'Supplier', customerName: 'Customer', currency: 'EUR', netAmount: 100, taxAmount: 19, grossAmount: 119, lineItems: [{ positionIndex: 1, description: 'Item', taxRate: 19, netAmount: 100, taxAmount: 19, grossAmount: 119 }] };
  it('validates compliant invoice', () => { const result = validateGoBDCompliance(validInvoice); expect(result.isCompliant).toBe(true); expect(result.badge).toBe('compliant'); });
  it('detects missing number', () => { const result = validateGoBDCompliance({ ...validInvoice, number: '' }); expect(result.isCompliant).toBe(false); expect(result.violations.some(v => v.code === GOB_ERROR_CODES.MISSING_INVOICE_NUMBER)).toBe(true); });
  it('detects sum mismatch', () => { const result = validateGoBDCompliance({ ...validInvoice, grossAmount: 200 }); expect(result.violations.some(v => v.code === GOB_ERROR_CODES.SUM_MISMATCH)).toBe(true); });
  it('detects invalid tax rate', () => { const result = validateGoBDCompliance({ ...validInvoice, lineItems: [{ ...validInvoice.lineItems[0], taxRate: 12 }] }); expect(result.violations.some(v => v.code === GOB_ERROR_CODES.INVALID_TAX_RATE)).toBe(true); });
  it('warns about missing due date', () => { const result = validateGoBDCompliance({ ...validInvoice, dueDate: null }); expect(result.warnings.some(w => w.code === GOB_WARNING_CODES.MISSING_DUE_DATE)).toBe(true); });
  it('returns correct status text', () => { expect(getComplianceStatusText('compliant')).toBe('GoBD-konform'); expect(getComplianceStatusText('non-compliant')).toBe('Nicht GoBD-konform'); });
  it('checks compliance', () => { expect(isGoBDCompliant(validInvoice)).toBe(true); expect(isGoBDCompliant({ ...validInvoice, number: '' })).toBe(false); });
});
