/**
 * GoBD Rules Tests
 */

import { describe, it, expect } from 'bun:test';
import {
  validateRequiredFields,
  validateDateConstraints,
  validateSumCalculation,
  validateTaxRates,
  validateCurrency,
  validateLineItems,
  GOB_ERROR_CODES,
  GOB_WARNING_CODES,
} from '@/lib/gobd';
import type { InvoiceData, ValidationContext } from '@/lib/gobd';

describe('GoBD Rules', () => {
  const baseInvoice: InvoiceData = {
    id: 'test-123',
    number: 'RE-001',
    issueDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    supplierName: 'Lieferant GmbH',
    customerName: 'Kunde AG',
    currency: 'EUR',
    netAmount: 100.0,
    taxAmount: 19.0,
    grossAmount: 119.0,
    lineItems: [
      {
        positionIndex: 1,
        description: 'Leistung',
        quantity: 1,
        unitPrice: 100.0,
        taxRate: 19,
        netAmount: 100.0,
        taxAmount: 19.0,
        grossAmount: 119.0,
      },
    ],
  };

  const createContext = (invoice: InvoiceData): ValidationContext => ({
    invoice,
    tolerance: 0.01,
  });

  describe('validateRequiredFields', () => {
    it('should pass for complete invoice', () => {
      const result = validateRequiredFields(createContext(baseInvoice));
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect missing invoice number', () => {
      const invoice = { ...baseInvoice, number: '' };
      const result = validateRequiredFields(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations[0].code).toBe(GOB_ERROR_CODES.MISSING_INVOICE_NUMBER);
    });

    it('should detect missing supplier name', () => {
      const invoice = { ...baseInvoice, supplierName: null };
      const result = validateRequiredFields(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.MISSING_SUPPLIER)).toBe(true);
    });

    it('should detect missing customer name', () => {
      const invoice = { ...baseInvoice, customerName: undefined };
      const result = validateRequiredFields(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.code === GOB_ERROR_CODES.MISSING_CUSTOMER)).toBe(true);
    });

    it('should warn about missing due date', () => {
      const invoice = { ...baseInvoice, dueDate: null };
      const result = validateRequiredFields(createContext(invoice));
      expect(result.warnings.some((w) => w.code === GOB_WARNING_CODES.MISSING_DUE_DATE)).toBe(true);
    });
  });

  describe('validateDateConstraints', () => {
    it('should pass for valid date', () => {
      const result = validateDateConstraints(createContext(baseInvoice));
      expect(result.passed).toBe(true);
    });

    it('should detect future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const invoice = { ...baseInvoice, issueDate: futureDate };
      const result = validateDateConstraints(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations[0].code).toBe(GOB_ERROR_CODES.FUTURE_DATE);
    });

    it('should detect invalid date format', () => {
      const invoice = { ...baseInvoice, issueDate: 'invalid-date' };
      const result = validateDateConstraints(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations[0].code).toBe(GOB_ERROR_CODES.INVALID_DATE_FORMAT);
    });
  });

  describe('validateSumCalculation', () => {
    it('should pass for correct sum', () => {
      const result = validateSumCalculation(createContext(baseInvoice));
      expect(result.passed).toBe(true);
    });

    it('should detect sum mismatch', () => {
      const invoice = { ...baseInvoice, grossAmount: 200.0 };
      const result = validateSumCalculation(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations[0].code).toBe(GOB_ERROR_CODES.SUM_MISMATCH);
    });

    it('should allow tolerance', () => {
      const invoice = { ...baseInvoice, grossAmount: 119.005 }; // Within 0.01 tolerance
      const result = validateSumCalculation(createContext(invoice));
      expect(result.passed).toBe(true);
    });

    it('should skip if amounts missing', () => {
      const invoice = { ...baseInvoice, netAmount: null };
      const result = validateSumCalculation(createContext(invoice));
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('validateTaxRates', () => {
    it('should pass for valid tax rate 19%', () => {
      const result = validateTaxRates(createContext(baseInvoice));
      expect(result.passed).toBe(true);
    });

    it('should pass for valid tax rate 7%', () => {
      const invoice = {
        ...baseInvoice,
        lineItems: [{ ...baseInvoice.lineItems![0], taxRate: 7 }],
      };
      const result = validateTaxRates(createContext(invoice));
      expect(result.passed).toBe(true);
    });

    it('should pass for valid tax rate 0%', () => {
      const invoice = {
        ...baseInvoice,
        lineItems: [{ ...baseInvoice.lineItems![0], taxRate: 0 }],
      };
      const result = validateTaxRates(createContext(invoice));
      expect(result.passed).toBe(true);
    });

    it('should detect invalid tax rate', () => {
      const invoice = {
        ...baseInvoice,
        lineItems: [{ ...baseInvoice.lineItems![0], taxRate: 12 }],
      };
      const result = validateTaxRates(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations[0].code).toBe(GOB_ERROR_CODES.INVALID_TAX_RATE);
    });

    it('should detect tax calculation error', () => {
      const invoice = {
        ...baseInvoice,
        lineItems: [{ ...baseInvoice.lineItems![0], taxAmount: 50.0 }], // Wrong tax
      };
      const result = validateTaxRates(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations[0].code).toBe(GOB_ERROR_CODES.TAX_CALCULATION_ERROR);
    });

    it('should warn about no line items', () => {
      const invoice = { ...baseInvoice, lineItems: [] };
      const result = validateTaxRates(createContext(invoice));
      expect(result.warnings.some((w) => w.code === GOB_WARNING_CODES.NO_LINE_ITEMS)).toBe(true);
    });
  });

  describe('validateCurrency', () => {
    it('should pass for EUR', () => {
      const result = validateCurrency(createContext(baseInvoice));
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn for non-EUR currency', () => {
      const invoice = { ...baseInvoice, currency: 'USD' };
      const result = validateCurrency(createContext(invoice));
      expect(result.passed).toBe(true);
      expect(result.warnings[0].code).toBe(GOB_WARNING_CODES.UNCOMMON_CURRENCY);
    });

    it('should detect invalid currency code', () => {
      const invoice = { ...baseInvoice, currency: 'EURO' };
      const result = validateCurrency(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations[0].code).toBe(GOB_ERROR_CODES.INVALID_CURRENCY);
    });
  });

  describe('validateLineItems', () => {
    it('should pass for valid line items', () => {
      const result = validateLineItems(createContext(baseInvoice));
      expect(result.passed).toBe(true);
    });

    it('should detect missing description', () => {
      const invoice = {
        ...baseInvoice,
        lineItems: [{ ...baseInvoice.lineItems![0], description: '' }],
      };
      const result = validateLineItems(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations[0].code).toBe(GOB_ERROR_CODES.MISSING_LINE_ITEM_DESCRIPTION);
    });

    it('should detect line item sum mismatch', () => {
      const invoice = {
        ...baseInvoice,
        lineItems: [{ ...baseInvoice.lineItems![0], netAmount: 50.0 }],
      };
      const result = validateLineItems(createContext(invoice));
      expect(result.passed).toBe(false);
      expect(result.violations[0].code).toBe(GOB_ERROR_CODES.LINE_ITEM_SUM_MISMATCH);
    });

    it('should skip if no line items', () => {
      const invoice = { ...baseInvoice, lineItems: [] };
      const result = validateLineItems(createContext(invoice));
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
