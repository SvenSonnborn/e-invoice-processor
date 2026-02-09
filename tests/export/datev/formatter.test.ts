/**
 * DATEV Export Tests
 * Tests for DATEV CSV generation and validation
 */

import { describe, it, expect } from "bun:test";
import type { DatevEntry, DatevInvoice, DatevExportConfig } from "../../../src/lib/export/datev/types";
import {
  validateDatevEntry,
  validateExportConfig,
  formatAmount,
  formatDate,
  formatDateFromISO,
} from "../../../src/lib/export/datev/validator";
import {
  mapInvoiceToDatevEntries,
  mapTaxRateToSteuerschluessel,
  DEFAULT_INVOICE_MAPPING,
} from "../../../src/lib/export/datev/mapper";
import {
  generateHeader,
  generateRow,
  generateCSV,
  generateCSVWithBOM,
  generateFilename,
  UTF8_BOM,
} from "../../../src/lib/export/datev/csv-generator";
import {
  formatInvoicesForDatev,
  previewExport,
  getExportSummary,
} from "../../../src/lib/export/datev/formatter";
import { DATEV_STEUERSCHLUESSEL } from "../../../src/lib/export/datev/constants";

describe("DATEV Export", () => {
  describe("Validator", () => {
    describe("validateDatevEntry", () => {
      it("should validate a correct entry", () => {
        const entry: DatevEntry = {
          datum: "31122024",
          konto: "4400",
          gegenkonto: "5000",
          buchungstext: "Testbuchung",
          umsatzSoll: 1000.0,
          umsatzHaben: 0,
        };

        const errors = validateDatevEntry(entry);
        expect(errors).toHaveLength(0);
      });

      it("should fail for invalid date format", () => {
        const entry: DatevEntry = {
          datum: "2024-12-31",
          konto: "4400",
          gegenkonto: "5000",
          buchungstext: "Test",
          umsatzSoll: 100,
          umsatzHaben: 0,
        };

        const errors = validateDatevEntry(entry);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].field).toBe("datum");
      });

      it("should fail for zero amounts", () => {
        const entry: DatevEntry = {
          datum: "31122024",
          konto: "4400",
          gegenkonto: "5000",
          buchungstext: "Test",
          umsatzSoll: 0,
          umsatzHaben: 0,
        };

        const errors = validateDatevEntry(entry);
        expect(errors.some(e => e.field === "umsatz")).toBe(true);
      });
    });

    describe("formatAmount", () => {
      it("should format amount with comma separator", () => {
        expect(formatAmount(1234.56)).toBe("1234,56");
        expect(formatAmount(100)).toBe("100,00");
        expect(formatAmount(0)).toBe("0,00");
      });
    });

    describe("formatDate", () => {
      it("should format date to DDMMYYYY", () => {
        const date = new Date(2024, 11, 31);
        expect(formatDate(date)).toBe("31122024");
      });
    });
  });

  describe("Mapper", () => {
    it("should map 19% to standard tax key", () => {
      expect(mapTaxRateToSteuerschluessel(19, DEFAULT_INVOICE_MAPPING, true)).toBe(
        DATEV_STEUERSCHLUESSEL.VORSTEUER_19
      );
    });

    const baseInvoice: DatevInvoice = {
      id: "inv-123",
      number: "RE-2024-001",
      supplierName: "Test Supplier",
      customerName: "Test Customer",
      issueDate: new Date(2024, 11, 31),
      currency: "EUR",
      netAmount: 1000,
      taxAmount: 190,
      grossAmount: 1190,
      taxRate: 19,
      isIncoming: true,
    };

    it("should create entries for incoming invoice", () => {
      const entries = mapInvoiceToDatevEntries(baseInvoice);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].konto).toBe(DEFAULT_INVOICE_MAPPING.kontoEingangsrechnung);
    });
  });

  describe("CSV Generator", () => {
    it("should generate correct header format", () => {
      const header = generateHeader();
      expect(header).toContain("DTVF");
      expect(header).toContain("700");
    });

    it("should include UTF-8 BOM", () => {
      const entries: DatevEntry[] = [
        {
          datum: "31122024",
          konto: "4400",
          gegenkonto: "5000",
          buchungstext: "Test",
          umsatzSoll: 100,
          umsatzHaben: 0,
        },
      ];

      const csv = generateCSVWithBOM(entries);
      expect(csv.startsWith(UTF8_BOM)).toBe(true);
    });
  });

  describe("Formatter", () => {
    const testInvoices: DatevInvoice[] = [
      {
        id: "inv-1",
        number: "RE-001",
        supplierName: "Supplier A",
        issueDate: new Date(2024, 0, 15),
        currency: "EUR",
        netAmount: 1000,
        taxAmount: 190,
        grossAmount: 1190,
        taxRate: 19,
        isIncoming: true,
      },
    ];

    it("should successfully export invoices", () => {
      const result = formatInvoicesForDatev(testInvoices);
      expect(result.success).toBe(true);
      expect(result.csv).toBeTruthy();
    });
  });
});
