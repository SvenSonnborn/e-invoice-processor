import { describe, it, expect } from 'bun:test';
import { parseOcrInvoiceData } from '@/src/server/parsers/invoice';

describe('parseOcrInvoiceData', () => {
  describe('happy path - full invoice data', () => {
    const fullInvoiceData = {
      format: 'UNKNOWN',
      number: 'NL-2026-00041',
      supplier: { name: 'Nordlicht IT Services GmbH' },
      customer: { name: 'Kronberg Maschinenbau AG' },
      issueDate: '2026-02-09',
      dueDate: '2026-02-23',
      totals: {
        currency: 'EUR',
        netAmount: '2090.00',
        taxAmount: '397.10',
        grossAmount: '2487.10',
      },
      lineItems: [
        {
          description: 'Beratung – Prozessanalyse (Remote)',
          quantity: 6,
          unitPrice: 120.0,
          total: 720.0,
        },
        {
          description: 'Implementierung – OCR Pipeline Setup',
          quantity: 8,
          unitPrice: 135.0,
          total: 1080.0,
        },
        {
          description: 'Support & Monitoring (Monatspauschale)',
          quantity: 1,
          unitPrice: 290.0,
          total: 290.0,
        },
      ],
    };

    it('returns success: true', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      expect(result.success).toBe(true);
    });

    it('parses invoice number', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.number).toBe('NL-2026-00041');
    });

    it('flattens supplier name', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.supplierName).toBe(
        'Nordlicht IT Services GmbH'
      );
    });

    it('flattens customer name', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.customerName).toBe(
        'Kronberg Maschinenbau AG'
      );
    });

    it('parses ISO date strings to Date objects', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.issueDate).toBeInstanceOf(Date);
      expect(result.invoiceFields.issueDate!.toISOString()).toBe(
        '2026-02-09T00:00:00.000Z'
      );
      expect(result.invoiceFields.dueDate).toBeInstanceOf(Date);
      expect(result.invoiceFields.dueDate!.toISOString()).toBe(
        '2026-02-23T00:00:00.000Z'
      );
    });

    it('parses string amounts to numbers', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.netAmount).toBe(2090.0);
      expect(result.invoiceFields.taxAmount).toBe(397.1);
      expect(result.invoiceFields.grossAmount).toBe(2487.1);
    });

    it('extracts currency', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      if (!result.success) throw new Error('Expected success');
      expect(result.currency).toBe('EUR');
    });

    it('extracts format', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      if (!result.success) throw new Error('Expected success');
      expect(result.format).toBe('UNKNOWN');
    });

    it('parses line items with 1-based positionIndex', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      if (!result.success) throw new Error('Expected success');
      expect(result.lineItems).toHaveLength(3);
      expect(result.lineItems[0].positionIndex).toBe(1);
      expect(result.lineItems[1].positionIndex).toBe(2);
      expect(result.lineItems[2].positionIndex).toBe(3);
    });

    it('maps line item total to grossAmount', () => {
      const result = parseOcrInvoiceData(fullInvoiceData);
      if (!result.success) throw new Error('Expected success');
      expect(result.lineItems[0].grossAmount).toBe(720.0);
      expect(result.lineItems[0].description).toBe(
        'Beratung – Prozessanalyse (Remote)'
      );
      expect(result.lineItems[0].quantity).toBe(6);
      expect(result.lineItems[0].unitPrice).toBe(120.0);
    });
  });

  describe('minimal invoice (no dueDate, no netAmount/taxAmount)', () => {
    const minimalData = {
      format: 'UNKNOWN',
      number: 'RE-2024-100',
      supplier: { name: 'Kleinunternehmer Max Mustermann' },
      customer: { name: 'Firma Schmidt & Co. KG' },
      issueDate: '2024-06-20',
      totals: {
        currency: 'EUR',
        grossAmount: '500.00',
      },
      lineItems: [
        {
          description: 'Beratungsleistung',
          quantity: 1,
          unitPrice: 500.0,
          total: 500.0,
        },
      ],
    };

    it('returns success with undefined optional fields', () => {
      const result = parseOcrInvoiceData(minimalData);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.dueDate).toBeUndefined();
      expect(result.invoiceFields.netAmount).toBeUndefined();
      expect(result.invoiceFields.taxAmount).toBeUndefined();
      expect(result.invoiceFields.grossAmount).toBe(500.0);
    });
  });

  describe('credit note with negative amounts', () => {
    const creditNoteData = {
      format: 'UNKNOWN',
      number: 'ROS-GU-2026-0006',
      supplier: { name: 'Rheinland Office Supplies GmbH' },
      customer: { name: 'Büro Fischer KG' },
      issueDate: '2026-02-10',
      dueDate: '2026-02-24',
      totals: {
        currency: 'EUR',
        netAmount: '-94.89',
        taxAmount: '-18.03',
        grossAmount: '-112.92',
      },
      lineItems: [
        {
          description: 'Gutschrift für Retoure: Toner Kartusche (RMA 58421)',
          quantity: 1,
          unitPrice: -89.9,
          total: -89.9,
        },
        {
          description: 'Gutschrift Versandkosten',
          quantity: 1,
          unitPrice: -4.99,
          total: -4.99,
        },
      ],
    };

    it('accepts negative amounts for credit notes', () => {
      const result = parseOcrInvoiceData(creditNoteData);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.netAmount).toBe(-94.89);
      expect(result.invoiceFields.taxAmount).toBe(-18.03);
      expect(result.invoiceFields.grossAmount).toBe(-112.92);
    });

    it('accepts negative line item amounts', () => {
      const result = parseOcrInvoiceData(creditNoteData);
      if (!result.success) throw new Error('Expected success');
      expect(result.lineItems[0].unitPrice).toBe(-89.9);
      expect(result.lineItems[0].grossAmount).toBe(-89.9);
    });
  });

  describe('German date format', () => {
    it('parses DD.MM.YYYY dates', () => {
      const data = {
        issueDate: '09.02.2026',
        dueDate: '23.02.2026',
      };
      const result = parseOcrInvoiceData(data);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.issueDate!.toISOString()).toBe(
        '2026-02-09T00:00:00.000Z'
      );
      expect(result.invoiceFields.dueDate!.toISOString()).toBe(
        '2026-02-23T00:00:00.000Z'
      );
    });

    it('parses single-digit day/month', () => {
      const data = { issueDate: '1.3.2026' };
      const result = parseOcrInvoiceData(data);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.issueDate!.toISOString()).toBe(
        '2026-03-01T00:00:00.000Z'
      );
    });
  });

  describe('German number format', () => {
    it('parses "1.234,56" correctly', () => {
      const data = { totals: { grossAmount: '1.234,56' } };
      const result = parseOcrInvoiceData(data);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.grossAmount).toBe(1234.56);
    });

    it('parses "12.345.678,90" correctly', () => {
      const data = { totals: { grossAmount: '12.345.678,90' } };
      const result = parseOcrInvoiceData(data);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.grossAmount).toBe(12345678.9);
    });

    it('parses simple comma decimal "500,00" correctly', () => {
      const data = { totals: { grossAmount: '500,00' } };
      const result = parseOcrInvoiceData(data);
      if (!result.success) throw new Error('Expected success');
      expect(result.invoiceFields.grossAmount).toBe(500.0);
    });
  });

  describe('invalid data handling', () => {
    it('rejects null input', () => {
      const result = parseOcrInvoiceData(null);
      expect(result.success).toBe(false);
    });

    it('rejects non-object input', () => {
      const result = parseOcrInvoiceData('not an object');
      expect(result.success).toBe(false);
    });

    it('returns structured errors with path and message', () => {
      const result = parseOcrInvoiceData({ lineItems: [{ description: 123 }] });
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].path).toBeDefined();
      expect(result.errors[0].message).toBeDefined();
    });

    it('rejects invalid currency length', () => {
      const data = { totals: { currency: 'EURO' } };
      const result = parseOcrInvoiceData(data);
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.errors.some((e) => e.path.includes('currency'))).toBe(true);
    });
  });

  describe('empty/missing fields', () => {
    it('accepts empty object with defaults', () => {
      const result = parseOcrInvoiceData({});
      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.format).toBe('UNKNOWN');
      expect(result.lineItems).toEqual([]);
    });

    it('defaults missing lineItems to empty array', () => {
      const result = parseOcrInvoiceData({ number: 'TEST-001' });
      if (!result.success) throw new Error('Expected success');
      expect(result.lineItems).toEqual([]);
    });

    it('defaults currency to EUR when totals present without currency', () => {
      const result = parseOcrInvoiceData({ totals: { grossAmount: '100.00' } });
      if (!result.success) throw new Error('Expected success');
      expect(result.currency).toBe('EUR');
    });
  });

  describe('format passthrough', () => {
    it('passes through ZUGFERD format', () => {
      const result = parseOcrInvoiceData({ format: 'ZUGFERD' });
      if (!result.success) throw new Error('Expected success');
      expect(result.format).toBe('ZUGFERD');
    });

    it('passes through XRECHNUNG format', () => {
      const result = parseOcrInvoiceData({ format: 'XRECHNUNG' });
      if (!result.success) throw new Error('Expected success');
      expect(result.format).toBe('XRECHNUNG');
    });

    it('rejects invalid format values', () => {
      const result = parseOcrInvoiceData({ format: 'INVALID' });
      expect(result.success).toBe(false);
    });
  });
});
