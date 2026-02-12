import { describe, it, expect } from 'bun:test';
import {
  mapToInvoiceModel,
  mapToExtendedInvoiceData,
} from '@/src/lib/zugferd/mapper';
import type { ZUGFeRDInvoice } from '@/src/lib/zugferd/types';

describe('Invoice Mapper', () => {
  const sampleZugferd: ZUGFeRDInvoice = {
    documentId: 'INV-2024-001',
    documentType: '380',
    documentDate: '2024-01-15',
    metadata: { xmlVersion: '2.3', profile: 'EXTENDED', flavor: 'EXTENDED' },
    seller: {
      name: 'Test Seller GmbH',
      addressLine1: 'Test Street 123',
      city: 'Berlin',
      postcode: '10115',
      countryCode: 'DE',
      vatId: 'DE123456789',
    },
    buyer: {
      name: 'Test Buyer AG',
      addressLine1: 'Buyer Street 456',
      city: 'Munich',
      postcode: '80331',
      countryCode: 'DE',
      vatId: 'DE987654321',
    },
    currency: 'EUR',
    paymentTerms: {
      dueDate: '2024-02-15',
      description: 'Payment within 30 days',
    },
    payeeIban: 'DE89370400440532013000',
    payeeBic: 'COBADEFFXXX',
    monetarySummation: {
      taxBasisTotalAmount: '1000.00',
      taxTotalAmount: '190.00',
      grandTotalAmount: '1190.00',
    },
    lineItems: [
      {
        id: '1',
        description: 'Product A',
        billedQuantity: '10',
        unitPrice: '100.00',
        lineTotalAmount: '1000.00',
      },
    ],
    taxes: [
      { ratePercent: '19', basisAmount: '1000.00', calculatedAmount: '190.00' },
    ],
  };

  describe('mapToInvoiceModel', () => {
    it('should map to Invoice model', () => {
      const invoice = mapToInvoiceModel(sampleZugferd);
      expect(invoice.format).toBe('ZUGFERD');
      expect(invoice.number).toBe('INV-2024-001');
      expect(invoice.issueDate).toBe('2024-01-15');
      expect(invoice.dueDate).toBe('2024-02-15');
    });

    it('should map supplier information', () => {
      const invoice = mapToInvoiceModel(sampleZugferd);
      expect(invoice.supplier?.name).toBe('Test Seller GmbH');
    });

    it('should map customer information', () => {
      const invoice = mapToInvoiceModel(sampleZugferd);
      expect(invoice.customer?.name).toBe('Test Buyer AG');
    });

    it('should map totals with correct currency', () => {
      const invoice = mapToInvoiceModel(sampleZugferd);
      expect(invoice.totals?.currency).toBe('EUR');
      expect(invoice.totals?.netAmount).toBe('1000.00');
      expect(invoice.totals?.taxAmount).toBe('190.00');
      expect(invoice.totals?.grossAmount).toBe('1190.00');
    });

    it('should default currency to EUR when not specified', () => {
      const noCurrency = { ...sampleZugferd, currency: undefined };
      const invoice = mapToInvoiceModel(noCurrency);
      expect(invoice.totals?.currency).toBe('EUR');
    });

    it('should generate unique ID', () => {
      const invoice1 = mapToInvoiceModel(sampleZugferd);
      const invoice2 = mapToInvoiceModel(sampleZugferd);
      expect(invoice1.id).not.toBe(invoice2.id);
      expect(invoice1.id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('should map XRECHNUNG format when profile contains xrechnung', () => {
      const xr = {
        ...sampleZugferd,
        metadata: {
          ...sampleZugferd.metadata,
          profile: 'urn:xoev-de:kosit:standard:xrechnung_2.3',
        },
      };
      const invoice = mapToInvoiceModel(xr);
      expect(invoice.format).toBe('XRECHNUNG');
    });

    it('should handle minimal data', () => {
      const minimal: ZUGFeRDInvoice = {
        metadata: {},
        monetarySummation: {},
        lineItems: [],
        taxes: [],
      };
      const invoice = mapToInvoiceModel(minimal);
      expect(invoice.id).toBeDefined();
      expect(invoice.format).toBe('UNKNOWN');
      expect(invoice.number).toBeUndefined();
      expect(invoice.supplier).toBeUndefined();
      expect(invoice.customer).toBeUndefined();
    });
  });

  describe('mapToExtendedInvoiceData', () => {
    it('should map all extended fields', () => {
      const extended = mapToExtendedInvoiceData(sampleZugferd);
      expect(extended.rawData.documentId).toBe('INV-2024-001');
      expect(extended.lineItems).toHaveLength(1);
      expect(extended.lineItems[0].description).toBe('Product A');
      expect(extended.lineItems[0].quantity).toBe('10');
      expect(extended.lineItems[0].unitPrice).toBe('100.00');
      expect(extended.taxes).toHaveLength(1);
      expect(extended.supplierDetails?.address?.city).toBe('Berlin');
      expect(extended.supplierDetails?.vatId).toBe('DE123456789');
      expect(extended.customerDetails?.address?.city).toBe('Munich');
      expect(extended.paymentDetails?.dueDate).toBe('2024-02-15');
      expect(extended.paymentDetails?.iban).toBe('DE89370400440532013000');
      expect(extended.paymentDetails?.bic).toBe('COBADEFFXXX');
    });

    it('should handle data without line items', () => {
      const noLineItems: ZUGFeRDInvoice = { ...sampleZugferd, lineItems: [] };
      const extended = mapToExtendedInvoiceData(noLineItems);
      expect(extended.lineItems).toEqual([]);
    });

    it('should handle data without payment info', () => {
      const noPayment = {
        ...sampleZugferd,
        paymentTerms: undefined,
        payeeIban: undefined,
        payeeBic: undefined,
      };
      const extended = mapToExtendedInvoiceData(noPayment);
      expect(extended.paymentDetails).toBeDefined();
    });

    it('should handle data without VAT breakdown', () => {
      const noTaxes: ZUGFeRDInvoice = { ...sampleZugferd, taxes: [] };
      const extended = mapToExtendedInvoiceData(noTaxes);
      expect(extended.taxes).toEqual([]);
    });
  });
});
