import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parseInvoiceFromPDF, isPDF } from "@/src/lib/zugferd";

describe("ZUGFeRD Parser", () => {
  describe("parseInvoiceFromPDF", () => {
    it("should return success false and errors for non-PDF buffer", async () => {
      const notPdf = Buffer.from("This is not a PDF");
      const result = await parseInvoiceFromPDF(notPdf);
      expect(result.success).toBe(false);
      expect(result.errors).toContain("Invalid PDF file");
    });

    it("should return success false for PDF without embedded XML", async () => {
      const minimalPdf = Buffer.from(
        `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids []
/Count 0
>>
endobj
xref
0 3
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
trailer
<<
/Size 3
/Root 1 0 R
>>
startxref
106
%%EOF`
      );
      const result = await parseInvoiceFromPDF(minimalPdf);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("isPDF", () => {
    it("should return false for non-PDF buffer", () => {
      const notPdf = Buffer.from("This is not a PDF");
      expect(isPDF(notPdf)).toBe(false);
    });

    it("should return true for minimal PDF buffer", () => {
      const minimalPdf = Buffer.from(
        `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids []
/Count 0
>>
endobj
xref
0 3
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
trailer
<<
/Size 3
/Root 1 0 R
>>
startxref
106
%%EOF`
      );
      expect(isPDF(minimalPdf)).toBe(true);
    });
  });
});

describe("ZUGFeRD Parser Integration", () => {
  const fixturePath = join(process.cwd(), "tests", "fixtures", "zugferd-invoice.pdf");

  it("should parse ZUGFeRD 2.3 PDF with embedded CII XML when fixture is present", async () => {
    if (!existsSync(fixturePath)) {
      console.warn(
        "Skipping: place a ZUGFeRD sample PDF at tests/fixtures/zugferd-invoice.pdf (e.g. from https://github.com/ZUGFeRD/corpus) to run this test."
      );
      return;
    }
    const buffer = readFileSync(fixturePath);
    const result = await parseInvoiceFromPDF(buffer);
    expect(result.success).toBe(true);
    expect(result.invoice).toBeDefined();
    expect(result.invoice?.number ?? result.invoice?.id).toBeDefined();
    expect(result.detection.flavor).not.toBe("Unknown");
  });
});
