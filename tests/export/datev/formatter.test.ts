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
} from "../../../src/lib/export/datev/csv-generator";
import { UTF8_BOM, DATEV_STEUERSCHLUESSEL } from "../../../src/lib/export/datev/constants";
import {
  formatInvoicesForDatev,
  previewExport,
  getExportSummary,
} from "../../../src/lib/export/datev/formatter";

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

      it("should fail for missing account", () => {
        const entry: DatevEntry = {
          datum: "31122024",
          konto: "",
          gegenkonto: "5000",
          buchungstext: "Test",
          umsatzSoll: 100,
          umsatzHaben: 0,
        };

        const errors = validateDatevEntry(entry);
        expect(errors.some(e => e.field === "konto")).toBe(true);
      });

      it("should validate booking text length", () => {
        const entry: DatevEntry = {
          datum: "31122024",
          konto: "4400",
          gegenkonto: "5000",
          buchungstext: "A".repeat(70), // Too long
          umsatzSoll: 100,
          umsatzHaben: 0,
        };

        const errors = validateDatevEntry(entry);
        expect(errors.some(e => e.field === "buchungstext")).toBe(true);
      });
    });

    describe("validateExportConfig", () => {
      it("should validate correct config", () => {
        const config: DatevExportConfig = {
          encoding: "UTF-8",
          beraterNummer: "12345678",
          mandantenNummer: "00123",
        };

        const errors = validateExportConfig(config);
        expect(errors).toHaveLength(0);
      });

      it("should fail for invalid advisor number", () => {
        const config: DatevExportConfig = {
          encoding: "UTF-8",
          beraterNummer: "123456789", // Too long
        };

        const errors = validateExportConfig(config);
        expect(errors.some(e => e.field === "beraterNummer")).toBe(true);
      });

      it("should fail for invalid encoding", () => {
        const config: DatevExportConfig = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          encoding: "INVALID" as any,
        };

        const errors = validateExportConfig(config);
        expect(errors.some(e => e.field === "encoding")).toBe(true);
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
        const date = new Date(2024, 11, 31); // December 31, 2024
        expect(formatDate(date)).toBe("31122024");
      });
    });

    describe("formatDateFromISO", () => {
      it("should convert ISO date to DATEV format", () => {
        expect(formatDateFromISO("2024-12-31")).toBe("31122024");
        expect(formatDateFromISO("2024-01-15")).toBe("15012024");
      });

      it("should throw for invalid date", () => {
        expect(() => formatDateFromISO("invalid")).toThrow();
      });
    });
  });

  describe("Mapper", () => {
    describe("mapTaxRateToSteuerschluessel", () => {
      it("should map 19% to standard tax key", () => {
        expect(mapTaxRateToSteuerschluessel(19, DEFAULT_INVOICE_MAPPING, true)).toBe(
          DATEV_STEUERSCHLUESSEL.VORSTEUER_19
        );
        // With DEFAULT_INVOICE_MAPPING, steuerschluesselStandard ("9") always takes precedence
        expect(mapTaxRateToSteuerschluessel(19, DEFAULT_INVOICE_MAPPING, false)).toBe(
          DEFAULT_INVOICE_MAPPING.steuerschluesselStandard
        );
      });

      it("should map 7% to reduced tax key", () => {
        expect(mapTaxRateToSteuerschluessel(7, DEFAULT_INVOICE_MAPPING, true)).toBe(
          DATEV_STEUERSCHLUESSEL.VORSTEUER_7
        );
      });

      it("should map 0% to zero tax key", () => {
        expect(mapTaxRateToSteuerschluessel(0, DEFAULT_INVOICE_MAPPING, true)).toBe(
          DATEV_STEUERSCHLUESSEL.VORSTEUER_0
        );
      });
    });

    describe("mapInvoiceToDatevEntries", () => {
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

        const firstEntry = entries[0];
        expect(firstEntry.konto).toBe(DEFAULT_INVOICE_MAPPING.kontoEingangsrechnung);
        expect(firstEntry.umsatzSoll).toBe(1000);
      });

      it("should create entries for outgoing invoice", () => {
        const outgoingInvoice = { ...baseInvoice, isIncoming: false };
        const entries = mapInvoiceToDatevEntries(outgoingInvoice);

        const firstEntry = entries[0];
        expect(firstEntry.konto).toBe(DEFAULT_INVOICE_MAPPING.kontoAusgangsrechnung);
      });

      it("should include tax entry when tax amount > 0", () => {
        const entries = mapInvoiceToDatevEntries(baseInvoice);
        const taxEntry = entries.find(e => e.steuerschluessel === DATEV_STEUERSCHLUESSEL.VORSTEUER_19);
        expect(taxEntry).toBeDefined();
      });

      it("should include Kostenstelle and Kostenträger", () => {
        const invoiceWithKostenstelle: DatevInvoice = {
          ...baseInvoice,
          kostenstelle: "1000",
          kostentraeger: "2000",
        };

        const entries = mapInvoiceToDatevEntries(invoiceWithKostenstelle);
        expect(entries[0].kostenstelle).toBe("1000");
        expect(entries[0].kostentraeger).toBe("2000");
      });
    });
  });

  describe("CSV Generator", () => {
    describe("generateHeader", () => {
      it("should generate correct header format", () => {
        const header = generateHeader();
        expect(header).toContain("DTVF");
        expect(header).toContain("700");
        expect(header).toContain("21");
      });
    });

    describe("generateRow", () => {
      it("should generate correct row format", () => {
        const entry: DatevEntry = {
          datum: "31122024",
          konto: "4400",
          gegenkonto: "5000",
          buchungstext: "Test",
          umsatzSoll: 1000,
          umsatzHaben: 0,
        };

        const row = generateRow(entry);
        expect(row).toContain("4400");
        expect(row).toContain("5000");
        expect(row).toContain("Test");
        expect(row).toContain("S"); // Soll indicator
      });
    });

    describe("generateCSV", () => {
      it("should generate complete CSV with header and data", () => {
        const entries: DatevEntry[] = [
          {
            datum: "31122024",
            konto: "4400",
            gegenkonto: "5000",
            buchungstext: "Test",
            umsatzSoll: 1000,
            umsatzHaben: 0,
          },
        ];

        const csv = generateCSV(entries);
        const lines = csv.split("\r\n");

        expect(lines.length).toBeGreaterThanOrEqual(3); // Header + column names + data
        expect(lines[0]).toContain("DTVF");
      });

      it("should throw for empty entries", () => {
        expect(() => generateCSV([])).toThrow();
      });
    });

    describe("generateCSVWithBOM", () => {
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

    describe("generateFilename", () => {
      it("should generate filename with timestamp", () => {
        const filename = generateFilename();
        expect(filename).toContain("DATEV_Export");
        expect(filename).toContain(".csv");
      });

      it("should use custom prefix", () => {
        const filename = generateFilename("Custom_Export");
        expect(filename).toContain("Custom_Export");
      });
    });
  });

  describe("Formatter", () => {
    const testInvoices: DatevInvoice[] = [
      {
        id: "inv-1",
        number: "RE-001",
        supplierName: "Supplier A",
        customerName: "Customer A",
        issueDate: new Date(2024, 0, 15),
        currency: "EUR",
        netAmount: 1000,
        taxAmount: 190,
        grossAmount: 1190,
        taxRate: 19,
        isIncoming: true,
      },
      {
        id: "inv-2",
        number: "RE-002",
        supplierName: "Supplier B",
        customerName: "Customer B",
        issueDate: new Date(2024, 1, 20),
        currency: "EUR",
        netAmount: 500,
        taxAmount: 95,
        grossAmount: 595,
        taxRate: 19,
        isIncoming: false,
      },
    ];

    describe("formatInvoicesForDatev", () => {
      it("should successfully export invoices", () => {
        const result = formatInvoicesForDatev(testInvoices);

        expect(result.success).toBe(true);
        expect(result.csv).toBeTruthy();
        expect(result.filename).toContain(".csv");
        expect(result.entryCount).toBeGreaterThan(0);
      });

      it("should include errors for invalid data", () => {
        const invalidInvoice: DatevInvoice = {
          ...testInvoices[0],
          issueDate: new Date(NaN), // Invalid date
        };

        const result = formatInvoicesForDatev([invalidInvoice]);
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });
    });

    describe("previewExport", () => {
      it("should return export preview", () => {
        const preview = previewExport(testInvoices);

        expect(preview.invoiceCount).toBe(2);
        expect(preview.entryCount).toBeGreaterThan(0);
        expect(preview.totalAmount).toBeGreaterThan(0);
        expect(preview.dateRange).toBeDefined();
      });

      it("should calculate correct date range", () => {
        const preview = previewExport(testInvoices);

        expect(preview.dateRange?.from).toBe("2024-01-15");
        expect(preview.dateRange?.to).toBe("2024-02-20");
      });
    });

    describe("getExportSummary", () => {
      it("should return correct summary", () => {
        const summary = getExportSummary(testInvoices);

        expect(summary.invoiceCount).toBe(2);
        expect(summary.incomingCount).toBe(1);
        expect(summary.outgoingCount).toBe(1);
        expect(summary.totalNetAmount).toBe(1500);
        expect(summary.totalTaxAmount).toBe(285);
        expect(summary.totalGrossAmount).toBe(1785);
      });
    });
  });
});
