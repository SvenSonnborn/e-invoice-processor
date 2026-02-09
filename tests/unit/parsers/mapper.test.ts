import { describe, it, expect } from "bun:test";
import { mapToInvoice, mapToExtendedInvoice } from "@/src/server/parsers/mapper";
import type { RawInvoiceData } from "@/src/server/parsers/types";

describe("Invoice Mapper", () => {
  const sampleRawData: RawInvoiceData = {
    documentNumber: "INV-2024-001",
    documentType: "380",
    issueDate: "2024-01-15",
    dueDate: "2024-02-15",
    deliveryDate: "2024-01-10",
    currency: "EUR",
    seller: {
      name: "Test Seller GmbH",
      street: "Test Street 123",
      city: "Berlin",
      postalCode: "10115",
      country: "DE",
      vatId: "DE123456789",
      taxId: "1234567890",
    },
    buyer: {
      name: "Test Buyer AG",
      street: "Buyer Street 456",
      city: "Munich",
      postalCode: "80331",
      country: "DE",
      vatId: "DE987654321",
    },
    totals: {
      netAmount: 1000.00,
      taxAmount: 190.00,
      grossAmount: 1190.00,
      vatBreakdown: [
        { rate: 19, baseAmount: 1000.00, taxAmount: 190.00 },
      ],
    },
    lineItems: [
      {
        id: "1",
        description: "Product A",
        quantity: 10,
        unit: "C62",
        unitPrice: 100.00,
        lineTotal: 1000.00,
        vatRate: 19,
      },
    ],
    payment: {
      iban: "DE89370400440532013000",
      bic: "COBADEFFXXX",
      terms: "Payment within 30 days",
    },
  };

  describe("mapToInvoice", () => {
    it("should map raw data to Invoice model", () => {
      const invoice = mapToInvoice(sampleRawData, "ZUGFERD");
      
      expect(invoice.format).toBe("ZUGFERD");
      expect(invoice.number).toBe("INV-2024-001");
      expect(invoice.issueDate).toBe("2024-01-15");
      expect(invoice.dueDate).toBe("2024-02-15");
    });

    it("should map supplier information", () => {
      const invoice = mapToInvoice(sampleRawData, "ZUGFERD");
      
      expect(invoice.supplier?.name).toBe("Test Seller GmbH");
    });

    it("should map customer information", () => {
      const invoice = mapToInvoice(sampleRawData, "ZUGFERD");
      
      expect(invoice.customer?.name).toBe("Test Buyer AG");
    });

    it("should map totals with correct currency", () => {
      const invoice = mapToInvoice(sampleRawData, "ZUGFERD");
      
      expect(invoice.totals?.currency).toBe("EUR");
      expect(invoice.totals?.netAmount).toBe("1000.00");
      expect(invoice.totals?.taxAmount).toBe("190.00");
      expect(invoice.totals?.grossAmount).toBe("1190.00");
    });

    it("should default currency to EUR if not specified", () => {
      const dataWithoutCurrency: RawInvoiceData = {
        ...sampleRawData,
        currency: undefined,
      };
      
      const invoice = mapToInvoice(dataWithoutCurrency, "XRECHNUNG");
      expect(invoice.totals?.currency).toBe("EUR");
    });

    it("should generate unique ID", () => {
      const invoice1 = mapToInvoice(sampleRawData, "ZUGFERD");
      const invoice2 = mapToInvoice(sampleRawData, "ZUGFERD");
      
      expect(invoice1.id).not.toBe(invoice2.id);
      expect(invoice1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("should handle missing optional fields", () => {
      const minimalData: RawInvoiceData = {};
      const invoice = mapToInvoice(minimalData, "UNKNOWN");
      
      expect(invoice.id).toBeDefined();
      expect(invoice.format).toBe("UNKNOWN");
      expect(invoice.number).toBeUndefined();
      expect(invoice.supplier).toBeUndefined();
      expect(invoice.customer).toBeUndefined();
      expect(invoice.totals).toBeUndefined();
    });

    it("should handle partial data", () => {
      const partialData: RawInvoiceData = {
        documentNumber: "INV-001",
        currency: "USD",
      };
      
      const invoice = mapToInvoice(partialData, "XRECHNUNG");
      expect(invoice.number).toBe("INV-001");
      expect(invoice.format).toBe("XRECHNUNG");
    });
  });

  describe("mapToExtendedInvoice", () => {
    it("should map all extended fields", () => {
      const invoice = mapToExtendedInvoice(sampleRawData, "ZUGFERD");
      
      expect(invoice.format).toBe("ZUGFERD");
      expect(invoice.number).toBe("INV-2024-001");
      
      // Extended supplier fields
      expect(invoice.supplier?.name).toBe("Test Seller GmbH");
      expect(invoice.supplier?.street).toBe("Test Street 123");
      expect(invoice.supplier?.city).toBe("Berlin");
      expect(invoice.supplier?.postalCode).toBe("10115");
      expect(invoice.supplier?.country).toBe("DE");
      expect(invoice.supplier?.vatId).toBe("DE123456789");
      expect(invoice.supplier?.taxId).toBe("1234567890");
      
      // Extended customer fields
      expect(invoice.customer?.name).toBe("Test Buyer AG");
      expect(invoice.customer?.street).toBe("Buyer Street 456");
      expect(invoice.customer?.vatId).toBe("DE987654321");
      
      // Dates
      expect(invoice.issueDate).toBe("2024-01-15");
      expect(invoice.dueDate).toBe("2024-02-15");
      expect(invoice.deliveryDate).toBe("2024-01-10");
      
      // Currency
      expect(invoice.currency).toBe("EUR");
      
      // Extended totals
      expect(invoice.extendedTotals?.netAmount).toBe(1000.00);
      expect(invoice.extendedTotals?.taxAmount).toBe(190.00);
      expect(invoice.extendedTotals?.grossAmount).toBe(1190.00);
      expect(invoice.extendedTotals?.vatBreakdown).toHaveLength(1);
      expect(invoice.extendedTotals?.vatBreakdown?.[0].rate).toBe(19);
      expect(invoice.extendedTotals?.vatBreakdown?.[0].baseAmount).toBe("1000.00");
      expect(invoice.extendedTotals?.vatBreakdown?.[0].taxAmount).toBe("190.00");
      
      // Line items
      expect(invoice.lineItems).toHaveLength(1);
      expect(invoice.lineItems?.[0].id).toBe("1");
      expect(invoice.lineItems?.[0].description).toBe("Product A");
      expect(invoice.lineItems?.[0].quantity).toBe(10);
      expect(invoice.lineItems?.[0].unit).toBe("C62");
      expect(invoice.lineItems?.[0].unitPrice).toBe("100.00");
      expect(invoice.lineItems?.[0].lineTotal).toBe("1000.00");
      expect(invoice.lineItems?.[0].vatRate).toBe(19);
      
      // Payment
      expect(invoice.payment?.iban).toBe("DE89370400440532013000");
      expect(invoice.payment?.bic).toBe("COBADEFFXXX");
      expect(invoice.payment?.terms).toBe("Payment within 30 days");
    });

    it("should handle data without line items", () => {
      const dataWithoutItems: RawInvoiceData = {
        ...sampleRawData,
        lineItems: undefined,
      };
      
      const invoice = mapToExtendedInvoice(dataWithoutItems, "ZUGFERD");
      expect(invoice.lineItems).toBeUndefined();
    });

    it("should handle data without payment info", () => {
      const dataWithoutPayment: RawInvoiceData = {
        ...sampleRawData,
        payment: undefined,
      };
      
      const invoice = mapToExtendedInvoice(dataWithoutPayment, "ZUGFERD");
      expect(invoice.payment).toBeUndefined();
    });

    it("should handle data without VAT breakdown", () => {
      const dataWithoutVatBreakdown: RawInvoiceData = {
        ...sampleRawData,
        totals: {
          netAmount: 1000,
          taxAmount: 190,
          grossAmount: 1190,
          vatBreakdown: undefined,
        },
      };
      
      const invoice = mapToExtendedInvoice(dataWithoutVatBreakdown, "ZUGFERD");
      expect(invoice.extendedTotals?.vatBreakdown).toBeUndefined();
    });
  });
});
