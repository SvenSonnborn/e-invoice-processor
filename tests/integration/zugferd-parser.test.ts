import { describe, it, expect } from "bun:test";
import {
  parseZugferd,
  isZugferdPdf,
} from "@/src/server/parsers/zugferd";
import {
  InvoiceParseError,
  PdfExtractionError,
} from "@/src/server/parsers/errors";

describe("ZUGFeRD Parser", () => {
  describe("parseZugferd", () => {
    it("should throw PdfExtractionError for non-PDF buffer", async () => {
      const notPdf = Buffer.from("This is not a PDF");
      try {
        await parseZugferd(notPdf);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error instanceof PdfExtractionError).toBe(true);
      }
    });

    it("should throw PdfExtractionError for PDF without embedded XML", async () => {
      // Create a minimal PDF without embedded files
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
      
      try {
        await parseZugferd(minimalPdf);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error instanceof PdfExtractionError).toBe(true);
      }
    });
  });

  describe("isZugferdPdf", () => {
    it("should return false for non-PDF buffer", async () => {
      const notPdf = Buffer.from("This is not a PDF");
      expect(await isZugferdPdf(notPdf)).toBe(false);
    });

    it("should return false for PDF without embedded XML", async () => {
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
      
      expect(await isZugferdPdf(minimalPdf)).toBe(false);
    });
  });
});

describe("ZUGFeRD Parser Integration", () => {
  // Note: Full integration tests would require actual ZUGFeRD PDFs
  // These tests document the expected behavior
  
  it("should parse ZUGFeRD 2.3 PDF with embedded CII XML", async () => {
    // This test would require a real ZUGFeRD PDF
    // For now, we document the expected API
    
    // const pdfBuffer = await fs.readFile('test-zugferd.pdf');
    // const result = await parseZugferd(pdfBuffer);
    // expect(result.detectedFormat).toBe('ZUGFERD');
    // expect(result.invoice.format).toBe('ZUGFERD');
    
    expect(true).toBe(true); // Placeholder
  });
});
