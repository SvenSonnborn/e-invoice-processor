import { describe, it, expect } from "bun:test";
import type { DatevEntry, DatevInvoice } from "../../../src/lib/export/datev/types";
import { validateDatevEntry, formatAmount, formatDate } from "../../../src/lib/export/datev/validator";
import { mapInvoiceToDatevEntries, DEFAULT_INVOICE_MAPPING } from "../../../src/lib/export/datev/mapper";
import { generateHeader, generateCSVWithBOM, UTF8_BOM } from "../../../src/lib/export/datev/csv-generator";
import { formatInvoicesForDatev } from "../../../src/lib/export/datev/formatter";

describe("DATEV Export", () => {
  it("validates correct entry", () => {
    const entry: DatevEntry = { datum: "31122024", konto: "4400", gegenkonto: "5000", buchungstext: "Test", umsatzSoll: 1000, umsatzHaben: 0 };
    expect(validateDatevEntry(entry)).toHaveLength(0);
  });
  it("formats amount with comma", () => { expect(formatAmount(1234.56)).toBe("1234,56"); });
  it("formats date to DDMMYYYY", () => { expect(formatDate(new Date(2024, 11, 31))).toBe("31122024"); });
  it("maps invoice to entries", () => {
    const invoice: DatevInvoice = { id: "inv-1", number: "RE-001", supplierName: "Supplier", issueDate: new Date(2024, 0, 15), currency: "EUR", netAmount: 1000, taxAmount: 190, grossAmount: 1190, taxRate: 19, isIncoming: true };
    const entries = mapInvoiceToDatevEntries(invoice);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].konto).toBe(DEFAULT_INVOICE_MAPPING.kontoEingangsrechnung);
  });
  it("generates header with DTVF", () => { expect(generateHeader()).toContain("DTVF"); });
  it("includes UTF-8 BOM", () => {
    const entries: DatevEntry[] = [{ datum: "31122024", konto: "4400", gegenkonto: "5000", buchungstext: "Test", umsatzSoll: 100, umsatzHaben: 0 }];
    expect(generateCSVWithBOM(entries).startsWith(UTF8_BOM)).toBe(true);
  });
  it("exports invoices successfully", () => {
    const invoices: DatevInvoice[] = [{ id: "inv-1", number: "RE-001", supplierName: "Supplier", issueDate: new Date(2024, 0, 15), currency: "EUR", netAmount: 1000, taxAmount: 190, grossAmount: 1190, taxRate: 19, isIncoming: true }];
    const result = formatInvoicesForDatev(invoices);
    expect(result.success).toBe(true);
    expect(result.csv).toBeTruthy();
  });
});
