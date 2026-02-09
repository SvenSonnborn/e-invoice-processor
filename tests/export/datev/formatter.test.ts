/**
 * DATEV Export Tests
 */

import { describe, it, expect } from "bun:test";
import type { DatevEntry, DatevInvoice } from "../../../src/lib/export/datev/types";
import {
  validateDatevEntry,
  formatAmount,
  formatDate,
} from "../../../src/lib/export/datev/validator";
import {
  mapInvoiceToDatevEntries,
  mapTaxRateToSteuerschluessel,
  DEFAULT_INVOICE_MAPPING,
} from "../../../src/lib/export/datev/mapper";
import {
  generateHeader,
  generateCSVWithBOM,
  generateFilename,
  UTF8_BOM,
} from "../../../src/lib/export/datev/csv-generator";
import {
  formatInvoicesForDatev,
} from "../../../src/lib/export/datev/formatter";
import { DATEV_STEUERSCHLUESSEL } from "../../../src/lib/export/datev/constants";

describe("DATEV Export", () => {
  describe("Validator", () => {
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
    });

    it("should format amount with comma separator", () => {
      expect(formatAmount(1234.56)).toBe("1234,56");
      expect(formatAmount(100)).toBe("100,00");
    });

    it("should format date to DDMMYYYY", () => {
      const date = new Date(2024, 11, 31);
      expect(formatDate(date)).toBe("31122024");
    });
  });

  describe("Mapper", () => {
    it("should map 19% to standard tax key", () => {
      expect(mapTaxRateToSteuerschluessel(19, DEFAULT_INVOICE_MAPPING, true)).toBe(
        DATEV_STEUERSCHLUESSEL.VORSTEUER_19
      );
    });

    it("should create entries for incoming invoice", () => {
      const invoice: DatevInvoice = {
        id: "inv-123",
        number: "RE-2024-001",
        supplierName: "Test Supplier",
        issueDate: new Date(2024, 11, 31),
        currency: "EUR",
        netAmount: 1000,
        taxAmount: 190,
        grossAmount: 1190,
        taxRate: 19,
        isIncoming: true,
      };
      const entries = mapInvoiceToDatevEntries(invoice);
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
      const entries: DatevEntry[] = [{
        datum: "31122024",
        konto: "4400",
        gegenkonto: "5000",
        buchungstext: "Test",
        umsatzSoll: 100,
        umsatzHaben: 0,
      }];
      const csv = generateCSVWithBOM(entries);
      expect(csv.startsWith(UTF8_BOM)).toBe(true);
    });

    it("should generate filename with timestamp", () => {
      const filename = generateFilename();
      expect(filename).toContain("DATEV_Export");
      expect(filename).toContain(".csv");
    });
  });

  describe("Formatter", () => {
    it("should successfully export invoices", () => {
      const invoices: DatevInvoice[] = [{
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
      }];
      const result = formatInvoicesForDatev(invoices);
      expect(result.success).toBe(true);
      expect(result.csv).toBeTruthy();
      expect(result.filename).toContain(".csv");
    });
  });
});
