/**
 * OCR API Route Tests
 * 
 * Integration tests for the OCR upload endpoint.
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mock the OCR service
const mockProcessFile = () => Promise.resolve({
  text: "Rechnungsnummer: TEST-001",
  confidence: 0.98,
  pages: [{
    pageNumber: 1,
    text: "Rechnungsnummer: TEST-001",
    confidence: 0.98,
    blocks: []
  }],
  metadata: {
    fileType: "image/png",
    fileSize: 1024,
    pageCount: 1,
    processedAt: new Date()
  }
});

const mockParseInvoice = () => Promise.resolve({
  number: "TEST-001",
  issueDate: "2024-01-15",
  dueDate: "2024-02-15",
  supplier: {
    name: "Test Vendor"
  },
  totals: {
    grossAmount: 100.00,
    currency: "EUR",
    taxAmount: 19.00
  }
});

mock.module("@/src/server/services/ocr", () => ({
  ocrService: {
    processFile: mockProcessFile,
    parseInvoice: mockParseInvoice
  },
  OcrService: class {
    processFile = mockProcessFile;
    parseInvoice = mockParseInvoice;
  }
}));

mock.module("@/src/lib/logging", () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  }
}));

import { POST, GET } from "@/app/api/ocr/route";

describe("POST /api/ocr", () => {
  beforeEach(() => {
    // Reset mocks if needed
  });

  it("should return 400 if no file is provided", async () => {
    const formData = new FormData();
    
    const request = new Request("http://localhost/api/ocr", {
      method: "POST",
      body: formData
    });

    const response = await POST(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.message).toContain("No file provided");
  });

  it("should return 415 for unsupported file types", async () => {
    const formData = new FormData();
    const file = new File(["test"], "test.txt", { type: "text/plain" });
    formData.append("file", file);

    const request = new Request("http://localhost/api/ocr", {
      method: "POST",
      body: formData
    });

    const response = await POST(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(415);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("should process PNG file successfully", async () => {
    const formData = new FormData();
    const file = new File(["fake-image-data"], "invoice.png", { type: "image/png" });
    formData.append("file", file);

    const request = new Request("http://localhost/api/ocr", {
      method: "POST",
      body: formData
    });

    const response = await POST(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.text).toBe("Rechnungsnummer: TEST-001");
  });

  it("should process PDF file successfully", async () => {
    const formData = new FormData();
    const file = new File(["fake-pdf-data"], "invoice.pdf", { type: "application/pdf" });
    formData.append("file", file);

    const request = new Request("http://localhost/api/ocr", {
      method: "POST",
      body: formData
    });

    const response = await POST(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("should return invoice data in response", async () => {
    const formData = new FormData();
    const file = new File(["test"], "invoice.png", { type: "image/png" });
    formData.append("file", file);

    const request = new Request("http://localhost/api/ocr", {
      method: "POST",
      body: formData
    });

    const response = await POST(request as unknown as Request);
    const data = await response.json();

    expect(data.data.invoice).toBeDefined();
    expect(data.data.invoice.invoiceNumber).toBe("TEST-001");
    expect(data.data.invoice.totalAmount).toBe(100.00);
    expect(data.data.invoice.currency).toBe("EUR");
    expect(data.data.invoice.vendor).toBe("Test Vendor");
  });

  it("should include metadata in response", async () => {
    const formData = new FormData();
    const file = new File(["test"], "invoice.png", { type: "image/png" });
    formData.append("file", file);

    const request = new Request("http://localhost/api/ocr", {
      method: "POST",
      body: formData
    });

    const response = await POST(request as unknown as Request);
    const data = await response.json();

    expect(data.data.metadata).toBeDefined();
    expect(data.data.metadata.fileType).toBe("image/png");
    expect(data.data.metadata.pageCount).toBe(1);
    expect(data.data.metadata.processedAt).toBeDefined();
  });
});

describe("GET /api/ocr", () => {
  it("should return endpoint information", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.endpoint).toBe("/api/ocr");
    expect(data.description).toContain("Google Cloud Vision");
    expect(data.supportedTypes).toContain("application/pdf");
    expect(data.supportedTypes).toContain("image/png");
    expect(data.supportedTypes).toContain("image/jpeg");
    expect(data.methods.POST).toBeDefined();
  });

  it("should include file size limits", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.limits).toBeDefined();
    expect(data.limits.maxFileSize).toBe("10MB");
    expect(data.limits.timeout).toBe("60 seconds");
  });
});
