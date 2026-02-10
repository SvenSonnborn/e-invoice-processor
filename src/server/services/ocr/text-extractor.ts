/**
 * Text Extractor
 * 
 * Extracts structured text and invoice fields from Vision API responses.
 */

import { logger } from "@/src/lib/logging";
import type {
  OcrResult,
  OcrPage,
  TextBlock,
  BoundingBox,
  OcrInvoiceData,
} from "./index";
import type {
  AnnotateImageResponse,
  AnnotateFileResponse,
  FullTextAnnotation,
} from "./vision-client";

interface Vertex {
  x: number;
  y: number;
}

interface Paragraph {
  words: Array<{
    symbols: Array<{
      text: string;
      confidence: number;
    }>;
  }>;
}

interface Block {
  paragraphs: Paragraph[];
  blockType: string;
  confidence?: number;
  boundingBox?: {
    vertices: Vertex[];
  };
}

interface Page {
  blocks: Block[];
  confidence?: number;
  width?: number;
  height?: number;
}

export class TextExtractor {
  /**
   * Extract text from a single image response
   */
  extractFromResponse(
    response: AnnotateImageResponse,
    fileType: string,
    fileSize: number
  ): OcrResult {
    const fullText = response.fullTextAnnotation;

    if (!fullText) {
      return {
        text: "",
        confidence: 0,
        pages: [],
        metadata: {
          processedAt: new Date(),
          fileType,
          fileSize,
          pageCount: 0,
        },
      };
    }

    const pages = this.extractPages(fullText);
    const avgConfidence = this.calculateAverageConfidence(pages);

    return {
      text: fullText.text || "",
      confidence: avgConfidence,
      pages,
      metadata: {
        processedAt: new Date(),
        fileType,
        fileSize,
        pageCount: pages.length,
      },
    };
  }

  /**
   * Extract text from batch file response (PDF/TIFF)
   */
  extractFromBatchResponse(
    responses: AnnotateFileResponse[],
    fileSize: number
  ): OcrResult {
    const allPages: OcrPage[] = [];
    let fullText = "";

    for (const fileResponse of responses) {
      for (let i = 0; i < fileResponse.responses.length; i++) {
        const pageResponse = fileResponse.responses[i];
        const pageText = pageResponse.fullTextAnnotation;

        if (pageText) {
          const pages = this.extractPages(pageText);
          allPages.push(...pages.map((p, idx) => ({
            ...p,
            pageNumber: allPages.length + idx + 1,
          })));
          fullText += pageText.text + "\n";
        }
      }
    }

    const avgConfidence = this.calculateAverageConfidence(allPages);

    return {
      text: fullText.trim(),
      confidence: avgConfidence,
      pages: allPages,
      metadata: {
        processedAt: new Date(),
        fileType: "application/pdf",
        fileSize,
        pageCount: allPages.length,
      },
    };
  }

  /**
   * Extract pages from full text annotation
   */
  private extractPages(fullText: FullTextAnnotation): OcrPage[] {
    const pages: OcrPage[] = [];

    // The Vision API returns pages in the fullTextAnnotation
    const apiPages = (fullText as unknown as { pages?: Page[] }).pages || [];

    for (let i = 0; i < apiPages.length; i++) {
      const page = apiPages[i];
      const blocks: TextBlock[] = [];
      let pageText = "";

      for (const block of page.blocks || []) {
        const blockText = this.extractBlockText(block);
        if (blockText.trim()) {
          blocks.push({
            text: blockText,
            confidence: block.confidence || 0,
            boundingBox: this.extractBoundingBox(block),
          });
          pageText += blockText + "\n";
        }
      }

      pages.push({
        pageNumber: i + 1,
        text: pageText.trim(),
        confidence: page.confidence || 0,
        blocks,
      });
    }

    // If no pages structure, create a single page from the text
    if (pages.length === 0 && fullText.text) {
      pages.push({
        pageNumber: 1,
        text: fullText.text,
        confidence: 0.95, // Default confidence when not available
        blocks: [{
          text: fullText.text,
          confidence: 0.95,
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        }],
      });
    }

    return pages;
  }

  /**
   * Extract text from a block
   */
  private extractBlockText(block: Block): string {
    const words: string[] = [];

    for (const paragraph of block.paragraphs || []) {
      for (const word of paragraph.words || []) {
        const wordText = word.symbols?.map((s) => s.text).join("") || "";
        if (wordText) {
          words.push(wordText);
        }
      }
    }

    return words.join(" ");
  }

  /**
   * Extract bounding box from block
   */
  private extractBoundingBox(block: Block): BoundingBox {
    const vertices = block.boundingBox?.vertices || [];
    
    if (vertices.length < 2) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const xs = vertices.map((v) => v.x);
    const ys = vertices.map((v) => v.y);

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Calculate average confidence across all pages
   */
  private calculateAverageConfidence(pages: OcrPage[]): number {
    if (pages.length === 0) return 0;

    const totalConfidence = pages.reduce((sum, page) => sum + page.confidence, 0);
    return totalConfidence / pages.length;
  }

  /**
   * Parse invoice fields from OCR result
   */
  parseInvoiceFields(ocrResult: OcrResult): OcrInvoiceData {
    const text = ocrResult.text;
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    const result: OcrInvoiceData = {};
    const ensureTotals = () => {
      if (!result.totals) {
        result.totals = { currency: "EUR" };
      } else if (!result.totals.currency) {
        result.totals.currency = "EUR";
      }
      return result.totals;
    };

    // Extract invoice number (common patterns)
    const invoiceNumberPatterns = [
      /(?:Rechnungsnummer|Rechnung Nr\.?|Invoice No\.?|Invoice Number)[:\s]+([A-Z0-9\-/]+)/i,
      /(?:Nr\.?|No\.?)[:\s]+([A-Z0-9\-/]+)/i,
      /(?:Rechnung|Invoice)[:\s]+([A-Z0-9\-/]+)/i,
    ];

    for (const pattern of invoiceNumberPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.number = match[1].trim();
        break;
      }
    }

    // Extract dates
    const datePatterns = [
      // German date formats
      /(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/g,
      // ISO date format
      /(\d{4})-(\d{2})-(\d{2})/g,
    ];

    const foundDates: Date[] = [];
    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const date = this.parseDate(match[0]);
        if (date) foundDates.push(date);
      }
    }

    // Sort dates and assign to fields
    if (foundDates.length > 0) {
      foundDates.sort((a, b) => a.getTime() - b.getTime());
      
      // Invoice date is usually the earliest
      result.issueDate = foundDates[0].toISOString().split("T")[0];
      
      // Due date might be mentioned explicitly or be the later date
      if (foundDates.length > 1) {
        result.dueDate = foundDates[foundDates.length - 1].toISOString().split("T")[0];
      }
    }

    // Look for explicit due date
    const dueDateMatch = text.match(/(?:Zahlbar bis|Due Date|Fällig)[:\s]+(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i);
    if (dueDateMatch) {
      const dueDate = this.parseDate(dueDateMatch[1]);
      if (dueDate) {
        result.dueDate = dueDate.toISOString().split("T")[0];
      }
    }

    // Extract amounts
    const amountPatterns = [
      // Total/Gesamtbetrag patterns
      /(?:Gesamtbetrag|Gesamt|Total|Summe|Amount)[:\s]+(?:EUR|€|USD|\$)?\s*([\d.,]+)/i,
      // Line with amount at the end
      /(?:EUR|€|USD|\$)\s*([\d.,]+)\s*$/m,
      // Amount with currency symbol
      /([\d.,]+)\s*(?:EUR|€|USD|\$)/i,
    ];

    const amounts: number[] = [];
    for (const pattern of amountPatterns) {
      const matches = text.matchAll(new RegExp(pattern, "gmi"));
      for (const match of matches) {
        const amount = this.parseAmount(match[1]);
        if (amount !== null) {
          amounts.push(amount);
        }
      }
    }

    if (amounts.length > 0) {
      // Usually the largest amount is the total
      const grossAmount = Math.max(...amounts);
      ensureTotals().grossAmount = String(grossAmount);
    }

    // Extract currency
    if (text.includes("EUR") || text.includes("€")) {
      ensureTotals().currency = "EUR";
    } else if (text.includes("USD") || text.includes("$")) {
      ensureTotals().currency = "USD";
    } else {
      ensureTotals().currency = "EUR"; // Default for German invoices
    }

    // Extract vendor (sender)
    // Usually at the top of the invoice
    const vendorPatterns = [
      /(?:Von|From|Lieferant|Vendor)[:\s]+(.+?)(?:\n|$)/i,
      /^([A-Z][A-Za-z0-9\s&]+(?:GmbH|AG|KG|OHG|UG|e\.V|Inc|Ltd|LLC))/m,
    ];

    for (const pattern of vendorPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.supplier = { ...(result.supplier || {}), name: match[1].trim() };
        break;
      }
    }

    // If no vendor found, use first few lines
    if (!result.supplier && lines.length > 0) {
      result.supplier = { ...(result.supplier || {}), name: lines.slice(0, 3).join(" ").substring(0, 100) };
    }

    // Extract line items
    result.lineItems = this.extractLineItems(text);

    logger.debug({ fields: Object.keys(result) }, "Parsed invoice fields");

    return result;
  }

  /**
   * Extract line items from invoice text
   */
  private extractLineItems(text: string): Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }> {
    const items: ReturnType<typeof this.extractLineItems> = [];
    const lines = text.split("\n");

    // Look for patterns like "Description ... Qty ... Price ... Total"
    const itemPattern = /(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:x|×|Stk\.?|pcs)?\s*(?:EUR|€)?\s*([\d.,]+)\s*(?:EUR|€)?\s*([\d.,]+)/i;

    for (const line of lines) {
      const match = line.match(itemPattern);
      if (match) {
        const description = match[1].trim();
        const quantity = this.parseAmount(match[2]) || 1;
        const unitPrice = this.parseAmount(match[3]) || 0;
        const total = this.parseAmount(match[4]) || 0;

        if (description && (unitPrice > 0 || total > 0)) {
          items.push({
            description,
            quantity,
            unitPrice: unitPrice || total / quantity,
            total: total || unitPrice * quantity,
          });
        }
      }
    }

    return items;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date | null {
    // Try German format: DD.MM.YYYY
    const germanMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (germanMatch) {
      const day = parseInt(germanMatch[1], 10);
      const month = parseInt(germanMatch[2], 10) - 1;
      let year = parseInt(germanMatch[3], 10);
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }

    // Try ISO format: YYYY-MM-DD
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      return new Date(year, month, day);
    }

    // Try US format: MM/DD/YYYY
    const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (usMatch) {
      const month = parseInt(usMatch[1], 10) - 1;
      const day = parseInt(usMatch[2], 10);
      let year = parseInt(usMatch[3], 10);
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }

    return null;
  }

  /**
   * Parse amount string to number
   */
  private parseAmount(amountStr: string): number | null {
    if (!amountStr) return null;

    // Remove currency symbols and whitespace
    let clean = amountStr.trim().replace(/[€$\s]/g, "");

    // Handle German format: 1.234,56 -> 1234.56
    if (clean.includes(",") && clean.includes(".")) {
      // Determine which is the decimal separator
      const lastComma = clean.lastIndexOf(",");
      const lastDot = clean.lastIndexOf(".");
      
      if (lastComma > lastDot) {
        // German format
        clean = clean.replace(/\./g, "").replace(",", ".");
      } else {
        // US format
        clean = clean.replace(/,/g, "");
      }
    } else if (clean.includes(",")) {
      // Might be decimal comma
      const parts = clean.split(",");
      if (parts.length === 2 && parts[1].length <= 2) {
        clean = parts.join(".");
      } else {
        clean = clean.replace(/,/g, "");
      }
    }

    const value = parseFloat(clean);
    return isNaN(value) ? null : value;
  }
}
