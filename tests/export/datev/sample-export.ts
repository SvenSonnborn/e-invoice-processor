/**
 * DATEV Sample Export
 * Example usage and sample data for testing
 */

import type { DatevInvoice, DatevExportConfig, DatevInvoiceMapping } from "@/src/lib/export/datev/types";
import {
  formatInvoicesForDatev,
  exportInvoicesToBuffer,
  previewExport,
  getExportSummary,
} from "@/src/lib/export/datev/formatter";

/**
 * Sample incoming invoice (Eingangsrechnung)
 */
export const sampleIncomingInvoice: DatevInvoice = {
  id: "inv-sample-001",
  number: "ER-2024-001",
  supplierName: "Muster GmbH",
  customerName: "Meine Firma",
  issueDate: new Date(2024, 0, 15), // 15.01.2024
  dueDate: new Date(2024, 1, 14),   // 14.02.2024
  currency: "EUR",
  netAmount: 1000.00,
  taxAmount: 190.00,
  grossAmount: 1190.00,
  taxRate: 19.00,
  isIncoming: true,
  kostenstelle: "1000",
  kostentraeger: "2000",
  lineItems: [
    {
      description: "Büromaterial",
      netAmount: 500.00,
      taxAmount: 95.00,
      grossAmount: 595.00,
      taxRate: 19.00,
      konto: "6400",
    },
    {
      description: "Softwarelizenzen",
      netAmount: 500.00,
      taxAmount: 95.00,
      grossAmount: 595.00,
      taxRate: 19.00,
      konto: "6900",
    },
  ],
};

/**
 * Sample outgoing invoice (Ausgangsrechnung)
 */
export const sampleOutgoingInvoice: DatevInvoice = {
  id: "inv-sample-002",
  number: "AR-2024-001",
  supplierName: "Meine Firma",
  customerName: "Kunde AG",
  issueDate: new Date(2024, 0, 20), // 20.01.2024
  dueDate: new Date(2024, 1, 19),   // 19.02.2024
  currency: "EUR",
  netAmount: 2500.00,
  taxAmount: 475.00,
  grossAmount: 2975.00,
  taxRate: 19.00,
  isIncoming: false,
  lineItems: [
    {
      description: "Beratungsleistung",
      netAmount: 2000.00,
      taxAmount: 380.00,
      grossAmount: 2380.00,
      taxRate: 19.00,
    },
    {
      description: "Fahrtkosten",
      netAmount: 500.00,
      taxAmount: 95.00,
      grossAmount: 595.00,
      taxRate: 19.00,
    },
  ],
};

/**
 * Sample invoices array
 */
export const sampleInvoices: DatevInvoice[] = [
  sampleIncomingInvoice,
  sampleOutgoingInvoice,
];

/**
 * Sample export configuration
 */
export const sampleExportConfig: DatevExportConfig = {
  encoding: "UTF-8",
  beraterNummer: "12345678",
  mandantenNummer: "00123",
  wirtschaftsjahrBeginn: "01012024",
  sachkontenrahmen: "04",
  bezeichnung: "Buchungsstapel Januar 2024",
  buchungsstapelStart: 1,
  datumVon: "01012024",
  datumBis: "31012024",
};

/**
 * Sample invoice mapping
 */
export const sampleInvoiceMapping: DatevInvoiceMapping = {
  kontoEingangsrechnung: "4400",
  kontoAusgangsrechnung: "1200",
  gegenkontoBank: "1200",
  steuerschluesselStandard: "9",
  steuerschluesselErmäßigt: "8",
  steuerschluesselSteuerfrei: "0",
  defaultKostenstelle: "1000",
  defaultKostenträger: "2000",
};

/**
 * Generate sample export
 */
export function generateSampleExport(): string {
  const result = formatInvoicesForDatev(sampleInvoices, {
    format: "extended",
    detailed: false,
    config: sampleExportConfig,
    mapping: sampleInvoiceMapping,
  });

  if (!result.success) {
    throw new Error(`Export failed: ${result.errors?.map(e => e.message).join(", ")}`);
  }

  return result.csv;
}

/**
 * Generate sample export with detailed line items
 */
export function generateDetailedSampleExport(): string {
  const result = formatInvoicesForDatev(sampleInvoices, {
    format: "extended",
    detailed: true,
    config: sampleExportConfig,
    mapping: sampleInvoiceMapping,
  });

  if (!result.success) {
    throw new Error(`Export failed: ${result.errors?.map(e => e.message).join(", ")}`);
  }

  return result.csv;
}

/**
 * Get sample export preview
 */
export function getSampleExportPreview() {
  return previewExport(sampleInvoices);
}

/**
 * Get sample export summary
 */
export function getSampleExportSummary() {
  return getExportSummary(sampleInvoices);
}

/**
 * Export sample to buffer for file download
 */
export function exportSampleToBuffer() {
  return exportInvoicesToBuffer(sampleInvoices, {
    format: "extended",
    detailed: false,
    config: sampleExportConfig,
    mapping: sampleInvoiceMapping,
  });
}

/**
 * Print sample export to console (for debugging)
 */
export function printSampleExport(): void {
  const csv = generateSampleExport();
  console.log("=== DATEV Sample Export ===");
  console.log(csv);
  console.log("===========================");
}

/**
 * Run this to generate a sample file:
 * 
 * ```bash
 * bun run -e "import { exportSampleToFile } from './tests/export/datev/sample-export'; exportSampleToFile();"
 * ```
 */
export function exportSampleToFile(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");

  const csv = generateSampleExport();
  const filename = `DATEV_Sample_Export_${new Date().toISOString().split("T")[0]}.csv`;
  const filepath = path.join(process.cwd(), "tests", "export", "datev", filename);

  fs.writeFileSync(filepath, csv, "utf-8");
  console.log(`Sample export saved to: ${filepath}`);
}

// Export sample data for use in other files
const sampleExport = {
  sampleIncomingInvoice,
  sampleOutgoingInvoice,
  sampleInvoices,
  sampleExportConfig,
  sampleInvoiceMapping,
  generateSampleExport,
  generateDetailedSampleExport,
  getSampleExportPreview,
  getSampleExportSummary,
  exportSampleToBuffer,
  printSampleExport,
  exportSampleToFile,
};
export default sampleExport;
