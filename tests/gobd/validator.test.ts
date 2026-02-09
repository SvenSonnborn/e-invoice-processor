import { describe, it, expect } from 'bun:test';
import {
  validateGoBDCompliance,
  isGoBDCompliant,
  getComplianceStatusText,
  getBadgeColor,
  validateBeforeExport,
  VALID_TAX_RATES,
  GOB_ERROR_CODES,
  GOB_WARNING_CODES,
} from '../../src/lib/gobd';
import type { InvoiceData } from '../../src/lib/gobd';

describe('GoBD Validator', () => {
  const validInvoice: InvoiceData = {
    id: 'inv-123',
    number: 'RE-2024-001',
    issueDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    supplierName: 'Muster GmbH',
    customerName: 'Kunde AG',
    currency: 'EUR',
    netAmount: 100.0,
    taxAmount: 19.0,
    grossAmount: 119.0,
    lineItems: [
      {
        positionIndex: 1,
        description: 'Beratungsleistung',
        quantity: 1,
        unitPrice: 100.0,
        taxRate: 19,
        netAmount: 100.0,
        taxAmount: 19.0,
        grossAmount: 119.0,
      },
    ],
  };

  describe('validateGoBDCompliance', () => {
    it('should validate a compliant invoice', () => {
      const result = validateGoBDCompliance(validInvoice);

      expect(result.isCompliant).toBe(true);
      expect(result.badge).toBe('compliant');
      expect(result.violations).toHaveLength(0);
      expect(result.invoiceId).toBe('inv-123');
      expect(result.validatedAt).toBeInstanceOf(Date);
    });

    it('should detect missing invoice number', () => {
      const invoice = { ...validInvoice, number: '' };
      const result = validateGoBDCompliance(invoice);

      expect(result.isCompliant).toBe(false);
      expect(result.badge).toBe('non-compliant');
      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.MISSING_INVOICE_NUMBER)).toBe(true);
    });

    it('should detect missing issue date', () => {
      const invoice = { ...validInvoice, issueDate: null };
      const result = validateGoBDCompliance(invoice);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.MISSING_ISSUE_DATE)).toBe(true);
    });

    it('should detect future issue date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const invoice = { ...validInvoice, issueDate: futureDate };
      const result = validateGoBDCompliance(invoice);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.FUTURE_DATE)).toBe(true);
    });

    it('should detect sum mismatch', () => {
      const invoice = { ...validInvoice, grossAmount: 120.0 };
      const result = validateGoBDCompliance(invoice);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.SUM_MISMATCH)).toBe(true);
    });

    it('should allow sum within tolerance', () => {
      const invoice = { ...validInvoice, grossAmount: 119.01 };
      const result = validateGoBDCompliance(invoice);

      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.SUM_MISMATCH)).toBe(false);
    });

    it('should detect invalid tax rate', () => {
      const invoice = {
        ...validInvoice,
        lineItems: [
          {
            ...validInvoice.lineItems![0],
            taxRate: 12,
          },
        ],
      };
      const result = validateGoBDCompliance(invoice);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.INVALID_TAX_RATE)).toBe(true);
    });

    it('should accept valid tax rates', () => {
      for (const rate of VALID_TAX_RATES) {
        const invoice = {
          ...validInvoice,
          lineItems: [
            {
              ...validInvoice.lineItems![0],
              taxRate: rate,
              taxAmount: (100.0 * rate) / 100,
              grossAmount: 100.0 + (100.0 * rate) / 100,
            },
          ],
        };
        const result = validateGoBDCompliance(invoice);

        expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.INVALID_TAX_RATE)).toBe(false);
      }
    });

    it('should detect missing supplier name', () => {
      const invoice = { ...validInvoice, supplierName: '' };
      const result = validateGoBDCompliance(invoice);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.MISSING_SUPPLIER)).toBe(true);
    });

    it('should detect missing customer name', () => {
      const invoice = { ...validInvoice, customerName: '' };
      const result = validateGoBDCompliance(invoice);

      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.MISSING_CUSTOMER)).toBe(true);
    });

    it('should warn about missing due date', () => {
      const invoice = { ...validInvoice, dueDate: null };
      const result = validateGoBDCompliance(invoice);

      expect(result.isCompliant).toBe(true);
      expect(result.badge).toBe('warning');
      expect(result.warnings.some((w) => w.code === GOB_WARNING_CODES.MISSING_DUE_DATE)).toBe(true);
    });

    it('should warn about non-EUR currency', () => {
      const invoice = { ...validInvoice, currency: 'USD' };
      const result = validateGoBDCompliance(invoice);

      expect(result.isCompliant).toBe(true);
      expect(result.badge).toBe('warning');
      expect(result.warnings.some((w) => w.code === GOB_WARNING_CODES.UNCOMMON_CURRENCY)).toBe(true);
    });

    it('should validate line item totals', () => {
      const invoice = {
        ...validInvoice,
        lineItems: [
          {
            ...validInvoice.lineItems![0],
            netAmount: 50.0,
          },
        ],
      };
      const result = validateGoBDCompliance(invoice);

      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.LINE_ITEM_SUM_MISMATCH)).toBe(true);
    });

    it('should detect missing line item description', () => {
      const invoice = {
        ...validInvoice,
        lineItems: [
          {
            ...validInvoice.lineItems![0],
            description: '',
          },
        ],
      };
      const result = validateGoBDCompliance(invoice);

      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.MISSING_LINE_ITEM_DESCRIPTION)).toBe(true);
    });
  });

  describe('isGoBDCompliant', () => {
    it('should return true for valid invoice', () => {
      expect(isGoBDCompliant(validInvoice)).toBe(true);
    });

    it('should return false for invalid invoice', () => {
      const invoice = { ...validInvoice, number: '' };
      expect(isGoBDCompliant(invoice)).toBe(false);
    });
  });

  describe('getComplianceStatusText', () => {
    it('should return correct text for compliant', () => {
      expect(getComplianceStatusText('compliant')).toBe('GoBD-konform');
    });

    it('should return correct text for non-compliant', () => {
      expect(getComplianceStatusText('non-compliant')).toBe('Nicht GoBD-konform');
    });

    it('should return correct text for warning', () => {
      expect(getComplianceStatusText('warning')).toBe('GoBD-konform mit Hinweisen');
    });
  });

  describe('getBadgeColor', () => {
    it('should return green for compliant', () => {
      expect(getBadgeColor('compliant')).toBe('green');
    });

    it('should return red for non-compliant', () => {
      expect(getBadgeColor('non-compliant')).toBe('red');
    });

    it('should return yellow for warning', () => {
      expect(getBadgeColor('warning')).toBe('yellow');
    });
  });

  describe('validateBeforeExport', () => {
    it('should return result for valid invoice', () => {
      const result = validateBeforeExport(validInvoice);
      expect(result.isCompliant).toBe(true);
    });

    it('should throw error for invalid invoice', () => {
      const invoice = { ...validInvoice, number: '' };
      expect(() => validateBeforeExport(invoice)).toThrow('GoBD-Validierung fehlgeschlagen');
    });
  });
});
