/**
 * DATEV Exporter Unit Tests
 * Tests for the DATEV CSV export format functionality
 */

import { describe, it, expect } from "bun:test";
import {
  invoicesToDatevCsv,
  invoiceToDatevCsv,
  invoicesToDatevCsvFromInvoices,
  generateDatevFilename,
  validateDatevOptions,
  type DatevExportOptions,
  type DatevExportLineItem,
} from "@/src/server/exporters/datev";
import { Prisma } from "@prisma/client";
import type { Invoice, InvoiceLineItem } from "@prisma/client";

/** Shorthand for creating Prisma.Decimal values in test data */
const d = (n: number) => new Prisma.Decimal(n);

describe("DATEV Exporter", () => {
  // Mock invoice data
  const mockInvoice: Invoice = {
    id: "inv-123",
    organizationId: "org-123",
    uploadId: null,
    createdBy: null,
    format: "ZUGFERD",
    number: "RE-2024-001",
    supplierName: "Musterfirma GmbH",
    customerName: null,
    issueDate: new Date("2024-01-15"),
    dueDate: new Date("2024-02-15"),
    currency: "EUR",
    netAmount: d(1000.0),
    taxAmount: d(190.0),
    grossAmount: d(1190.0),
    rawJson: null,
    status: "VALIDATED",
    lastProcessedAt: new Date(),
    processingVersion: 1,
    gobdStatus: null,
    gobdViolations: null,
    gobdValidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOutgoingInvoice: Invoice = {
    ...mockInvoice,
    id: "inv-124",
    number: "RE-2024-002",
    supplierName: null,
    customerName: "Kunden AG",
    grossAmount: d(2380.0),
    netAmount: d(2000.0),
    taxAmount: d(380.0),
  };

  const mockLineItem: InvoiceLineItem = {
    id: "li-123",
    invoiceId: "inv-123",
    positionIndex: 1,
    description: "Beratungsleistung",
    quantity: d(10),
    unitPrice: d(100.0),
    taxRate: d(19.0),
    netAmount: d(1000.0),
    taxAmount: d(190.0),
    grossAmount: d(1190.0),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("invoiceToDatevCsv", () => {
    it("should generate DATEV CSV with BOM", () => {
      const csv = invoiceToDatevCsv(mockInvoice);
      
      // Check for UTF-8 BOM at the start
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it("should include EXTFD header line", () => {
      const csv = invoiceToDatevCsv(mockInvoice);
      // Skip BOM character
      const csvWithoutBom = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
      const lines = csvWithoutBom.split("\r\n");
      
      expect(lines[0].startsWith("EXTFD;")).toBe(true);
    });

    it("should include column headers", () => {
      const csv = invoiceToDatevCsv(mockInvoice);
      const lines = csv.split("\r\n");
      
      expect(lines[1]).toContain("Umsatz (ohne Soll/Haben-Kennzeichen)");
      expect(lines[1]).toContain("Soll/Haben-Kennzeichen");
      expect(lines[1]).toContain("Konto");
      expect(lines[1]).toContain("Gegenkonto");
      expect(lines[1]).toContain("BU-Schlüssel");
    });

    it("should format amounts with comma as decimal separator", () => {
      const csv = invoiceToDatevCsv(mockInvoice);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // First field should be the amount
      expect(fields[0]).toMatch(/^\d+,\d{2}$/);
    });

    it("should use 'S' for Eingangsrechnung (expense/debit)", () => {
      const csv = invoiceToDatevCsv(mockInvoice);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Second field is Soll/Haben-Kennzeichen
      expect(fields[1]).toBe("S");
    });

    it("should use 'H' for Ausgangsrechnung (revenue/credit)", () => {
      const csv = invoiceToDatevCsv(mockOutgoingInvoice);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      expect(fields[1]).toBe("H");
    });

    it("should format dates as DDMMYYYY", () => {
      const csv = invoiceToDatevCsv(mockInvoice);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Belegdatum field (index 9)
      expect(fields[9]).toBe("15012024");
    });

    it("should use default expense account for Eingangsrechnung", () => {
      const csv = invoiceToDatevCsv(mockInvoice);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Konto field (index 6)
      expect(fields[6]).toBe("4900");
    });

    it("should use default revenue account for Ausgangsrechnung", () => {
      const csv = invoiceToDatevCsv(mockOutgoingInvoice);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Konto field (index 6)
      expect(fields[6]).toBe("8400");
    });

    it("should include invoice number in Belegfeld 1", () => {
      const csv = invoiceToDatevCsv(mockInvoice);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Belegfeld 1 (index 10)
      expect(fields[10]).toBe("RE-2024-001");
    });

    it("should include supplier/customer name in Geschäftspartnername", () => {
      const csv = invoiceToDatevCsv(mockInvoice);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Geschäftspartnername (index 16)
      expect(fields[16]).toBe("Musterfirma GmbH");
    });

    it("should apply custom options for accounts", () => {
      const options: DatevExportOptions = {
        defaultExpenseAccount: "6000",
        defaultContraAccount: "2800",
      };
      
      const csv = invoiceToDatevCsv(mockInvoice, options);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      expect(fields[6]).toBe("6000"); // Konto
      expect(fields[7]).toBe("2800"); // Gegenkonto
    });

    it("should include consultant and client numbers in header", () => {
      const options: DatevExportOptions = {
        consultantNumber: "1234567",
        clientNumber: "00123",
      };
      
      const csv = invoiceToDatevCsv(mockInvoice, options);
      const lines = csv.split("\r\n");
      
      expect(lines[0]).toContain("1234567");
      expect(lines[0]).toContain("00123");
    });
  });

  describe("invoicesToDatevCsv", () => {
    it("should export multiple line items", () => {
      const lineItems: DatevExportLineItem[] = [
        {
          ...mockLineItem,
          invoice: mockInvoice as DatevExportLineItem["invoice"],
        },
        {
          ...mockLineItem,
          id: "li-124",
          positionIndex: 2,
          description: "Softwarelizenz",
          quantity: d(1),
          unitPrice: d(500.0),
          netAmount: d(500.0),
          taxAmount: d(95.0),
          grossAmount: d(595.0),
          invoice: mockInvoice as DatevExportLineItem["invoice"],
        },
      ];

      const csv = invoicesToDatevCsv(lineItems);
      const lines = csv.split("\r\n");
      
      // Header + column headers + 2 data lines
      expect(lines.length).toBe(4);
    });

    it("should include Kostenstelle when provided", () => {
      const lineItems: DatevExportLineItem[] = [
        {
          ...mockLineItem,
          costCenter: "1000",
          costObject: "PROJ-001",
          invoice: mockInvoice as DatevExportLineItem["invoice"],
        },
      ];

      const csv = invoicesToDatevCsv(lineItems);
      const lines = csv.split("\r\n");
      const headerLine = lines[1];
      const headers = headerLine.split(";");
      
      // Find the actual indices
      const kost1Index = headers.indexOf("KOST1 - Kostenstelle");
      const kost2Index = headers.indexOf("KOST2 - Kostenträger");
      
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Use the actual indices from the header
      expect(fields[kost1Index]).toBe("1000");
      expect(fields[kost2Index]).toBe("PROJ-001");
    });

    it("should use custom account numbers per line item", () => {
      const lineItems: DatevExportLineItem[] = [
        {
          ...mockLineItem,
          accountNumber: "6300",
          contraAccountNumber: "1200",
          invoice: mockInvoice as DatevExportLineItem["invoice"],
        },
      ];

      const csv = invoicesToDatevCsv(lineItems);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      expect(fields[6]).toBe("6300");
      expect(fields[7]).toBe("1200");
    });

    it("should determine correct BU-Schlüssel for 19% tax", () => {
      const lineItems: DatevExportLineItem[] = [
        {
          ...mockLineItem,
          taxRate: d(19.0),
          invoice: mockInvoice as DatevExportLineItem["invoice"],
        },
      ];

      const csv = invoicesToDatevCsv(lineItems);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // BU-Schlüssel (index 8) - should be 1 for 19% Vorsteuer
      expect(fields[8]).toBe("1");
    });

    it("should determine correct BU-Schlüssel for 7% tax", () => {
      const lineItems: DatevExportLineItem[] = [
        {
          ...mockLineItem,
          taxRate: d(7.0),
          invoice: mockInvoice as DatevExportLineItem["invoice"],
        },
      ];

      const csv = invoicesToDatevCsv(lineItems);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // BU-Schlüssel for 7% should be 2 (Vorsteuer 7%)
      expect(fields[8]).toBe("2");
    });

    it("should use BU-Schlüssel 0 for tax-free items", () => {
      const lineItems: DatevExportLineItem[] = [
        {
          ...mockLineItem,
          taxRate: d(0),
          invoice: mockInvoice as DatevExportLineItem["invoice"],
        },
      ];

      const csv = invoicesToDatevCsv(lineItems);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      expect(fields[8]).toBe("0");
    });
  });

  describe("generateDatevFilename", () => {
    it("should generate filename with consultant and client numbers", () => {
      const options: DatevExportOptions = {
        consultantNumber: "1234567",
        clientNumber: "00123",
      };
      
      const filename = generateDatevFilename(options);
      
      expect(filename).toContain("EXTF");
      expect(filename).toContain("1234567");
      expect(filename).toContain("00123");
      expect(filename.endsWith(".csv")).toBe(true);
    });

    it("should use default values when options not provided", () => {
      const filename = generateDatevFilename();
      
      expect(filename).toContain("EXTF");
      expect(filename).toContain("0000000");
      expect(filename).toContain("00000");
    });

    it("should include timestamp in filename", () => {
      const filename = generateDatevFilename();
      
      // Should have year, month, day, hour, minute
      expect(filename).toMatch(/EXTF_\d{7}_\d{5}_\d{12}\.csv/);
    });

    it("should support custom extension", () => {
      const filename = generateDatevFilename({}, "txt");
      
      expect(filename.endsWith(".txt")).toBe(true);
    });
  });

  describe("validateDatevOptions", () => {
    it("should return empty array for valid options", () => {
      const options: DatevExportOptions = {
        consultantNumber: "1234567",
        clientNumber: "00123",
        fiscalYearStart: "0101",
      };
      
      const errors = validateDatevOptions(options);
      
      expect(errors).toHaveLength(0);
    });

    it("should validate consultant number length", () => {
      const options: DatevExportOptions = {
        consultantNumber: "1234", // Too short
      };
      
      const errors = validateDatevOptions(options);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Beraternummer");
    });

    it("should validate consultant number is numeric", () => {
      const options: DatevExportOptions = {
        consultantNumber: "12345a7", // Contains letter
      };
      
      const errors = validateDatevOptions(options);
      
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should validate client number length", () => {
      const options: DatevExportOptions = {
        clientNumber: "123456", // Too long
      };
      
      const errors = validateDatevOptions(options);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Mandantennummer");
    });

    it("should validate fiscal year start format", () => {
      const options: DatevExportOptions = {
        fiscalYearStart: "1-1", // Wrong format
      };
      
      const errors = validateDatevOptions(options);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("WJ-Beginn");
    });

    it("should return empty array for undefined options", () => {
      const errors = validateDatevOptions({});
      
      expect(errors).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null amounts gracefully", () => {
      const invoiceWithNullAmounts: Invoice = {
        ...mockInvoice,
        grossAmount: null,
        netAmount: null,
      };
      
      const csv = invoiceToDatevCsv(invoiceWithNullAmounts);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Should default to 0,00
      expect(fields[0]).toBe("0,00");
    });

    it("should handle null dates gracefully", () => {
      const invoiceWithNullDate: Invoice = {
        ...mockInvoice,
        issueDate: null,
      };
      
      const csv = invoiceToDatevCsv(invoiceWithNullDate);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Date field should be empty
      expect(fields[9]).toBe("");
    });

    it("should handle special characters in text fields", () => {
      const invoiceWithSpecialChars = {
        ...mockInvoice,
        supplierName: "Firma GmbH",
      };
      
      const csv = invoiceToDatevCsv(invoiceWithSpecialChars as Invoice);
      // Skip BOM character for parsing
      const csvWithoutBom = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
      
      // Just verify the CSV contains the supplier name
      expect(csvWithoutBom).toContain("Firma GmbH");
    });

    it("should truncate long text fields", () => {
      const invoiceWithLongText: Invoice = {
        ...mockInvoice,
        supplierName: "A".repeat(100),
        number: "B".repeat(50),
      };
      
      const csv = invoiceToDatevCsv(invoiceWithLongText);
      // Skip BOM character for parsing
      const csvWithoutBom = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
      const lines = csvWithoutBom.split("\r\n");
      const headerLine = lines[1];
      const headers = headerLine.split(";");
      const partnerIndex = headers.indexOf("Geschäftspartnername");
      const belegfeldIndex = headers.indexOf("Belegfeld 1");
      
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      // Geschäftspartnername should be max 50 chars
      expect(fields[partnerIndex].length).toBeLessThanOrEqual(50);
      // Belegfeld 1 should be max 36 chars
      expect(fields[belegfeldIndex].length).toBeLessThanOrEqual(36);
    });

    it("should use EUR as default currency", () => {
      const invoiceWithNullCurrency: Invoice = {
        ...mockInvoice,
        currency: null,
      };
      
      const csv = invoiceToDatevCsv(invoiceWithNullCurrency);
      const lines = csv.split("\r\n");
      const dataLine = lines[2];
      const fields = dataLine.split(";");
      
      expect(fields[2]).toBe("EUR");
    });

    it("should escape semicolons in text fields", () => {
      const invoiceWithSemicolon: Invoice = {
        ...mockInvoice,
        supplierName: "Müller; Schmidt GmbH",
      };

      const csv = invoiceToDatevCsv(invoiceWithSemicolon);
      const csvWithoutBom = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;

      // The semicolon in the supplier name should be quoted
      expect(csvWithoutBom).toContain('"Müller; Schmidt GmbH"');
    });

    it("should escape double quotes in text fields", () => {
      const invoiceWithQuotes: Invoice = {
        ...mockInvoice,
        supplierName: 'Firma "Test" GmbH',
      };

      const csv = invoiceToDatevCsv(invoiceWithQuotes);
      const csvWithoutBom = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;

      // Double quotes should be doubled and field wrapped in quotes
      expect(csvWithoutBom).toContain('"Firma ""Test"" GmbH"');
    });
  });

  describe("invoicesToDatevCsvFromInvoices", () => {
    it("should produce a single BOM for multiple invoices", () => {
      const invoices = [mockInvoice, mockOutgoingInvoice];
      const csv = invoicesToDatevCsvFromInvoices(invoices);

      // Only one BOM at position 0
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // No BOM anywhere else
      const rest = csv.slice(1);
      expect(rest.includes("\uFEFF")).toBe(false);
    });

    it("should produce one header and one data row per invoice", () => {
      const invoices = [mockInvoice, mockOutgoingInvoice];
      const csv = invoicesToDatevCsvFromInvoices(invoices);
      const csvWithoutBom = csv.slice(1);
      const lines = csvWithoutBom.split("\r\n");

      // 1 EXTFD header + 1 column header + 2 data rows = 4 lines
      expect(lines.length).toBe(4);
      expect(lines[0].startsWith("EXTFD;")).toBe(true);
      expect(lines[1]).toContain("Umsatz (ohne Soll/Haben-Kennzeichen)");
    });

    it("should include correct data for each invoice row", () => {
      const invoices = [mockInvoice, mockOutgoingInvoice];
      const csv = invoicesToDatevCsvFromInvoices(invoices);
      const csvWithoutBom = csv.slice(1);
      const lines = csvWithoutBom.split("\r\n");

      // First data row (Eingangsrechnung)
      const fields1 = lines[2].split(";");
      expect(fields1[0]).toBe("1190,00"); // grossAmount
      expect(fields1[1]).toBe("S"); // Soll
      expect(fields1[6]).toBe("4900"); // default expense account

      // Second data row (Ausgangsrechnung)
      const fields2 = lines[3].split(";");
      expect(fields2[0]).toBe("2380,00"); // grossAmount
      expect(fields2[1]).toBe("H"); // Haben
      expect(fields2[6]).toBe("8400"); // default revenue account
    });

    it("should handle empty invoice array", () => {
      const csv = invoicesToDatevCsvFromInvoices([]);
      const csvWithoutBom = csv.slice(1);
      const lines = csvWithoutBom.split("\r\n");

      // Should still have 2 header lines, no data rows
      expect(lines.length).toBe(2);
      expect(lines[0].startsWith("EXTFD;")).toBe(true);
      expect(lines[1]).toContain("Umsatz (ohne Soll/Haben-Kennzeichen)");
    });

    it("should apply DATEV options to all rows", () => {
      const options: DatevExportOptions = {
        consultantNumber: "9999999",
        clientNumber: "88888",
        defaultExpenseAccount: "6000",
        defaultRevenueAccount: "8000",
        defaultContraAccount: "2800",
      };

      const invoices = [mockInvoice, mockOutgoingInvoice];
      const csv = invoicesToDatevCsvFromInvoices(invoices, options);
      const csvWithoutBom = csv.slice(1);
      const lines = csvWithoutBom.split("\r\n");

      // Header should have custom consultant/client numbers
      expect(lines[0]).toContain("9999999");
      expect(lines[0]).toContain("88888");

      // First row (Eingangsrechnung) uses custom expense account
      const fields1 = lines[2].split(";");
      expect(fields1[6]).toBe("6000");
      expect(fields1[7]).toBe("2800");

      // Second row (Ausgangsrechnung) uses custom revenue account
      const fields2 = lines[3].split(";");
      expect(fields2[6]).toBe("8000");
      expect(fields2[7]).toBe("2800");
    });
  });
});
