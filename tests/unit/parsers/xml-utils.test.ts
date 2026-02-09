import { describe, it, expect } from "bun:test";
import {
  validateXmlWellFormed,
  detectXmlFormat,
  parseXml,
  extractTextValue,
  extractAmount,
  extractCiiDate,
} from "@/src/server/parsers/xml-utils";
import { XmlValidationError } from "@/src/server/parsers/errors";

describe("XML Utils", () => {
  describe("validateXmlWellFormed", () => {
    it("should validate well-formed XML", () => {
      const xml = `<?xml version="1.0"?><root><item>test</item></root>`;
      expect(() => validateXmlWellFormed(xml)).not.toThrow();
    });

    it("should throw on malformed XML", () => {
      const xml = `<?xml version="1.0"?><root><item>test</root>`;
      let threw = false;
      try {
        validateXmlWellFormed(xml);
      } catch (e) {
        threw = e instanceof XmlValidationError;
      }
      expect(threw).toBe(true);
    });

    it("should throw on empty XML", () => {
      let threw = false;
      try {
        validateXmlWellFormed("");
      } catch (e) {
        threw = e instanceof XmlValidationError;
      }
      expect(threw).toBe(true);
    });
  });

  describe("detectXmlFormat", () => {
    it("should detect CII format", () => {
      const ciiXml = `<?xml version="1.0"?>
        <CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
          <test></test>
        </CrossIndustryInvoice>`;
      expect(detectXmlFormat(ciiXml)).toBe("CII");
    });

    it("should detect UBL format", () => {
      const ublXml = `<?xml version="1.0"?>
        <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
                 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
          <cbc:ID>123</cbc:ID>
        </Invoice>`;
      expect(detectXmlFormat(ublXml)).toBe("UBL");
    });

    it("should return UNKNOWN for unrecognized format", () => {
      const unknownXml = `<?xml version="1.0"?><root><test/></root>`;
      expect(detectXmlFormat(unknownXml)).toBe("UNKNOWN");
    });
  });

  describe("parseXml", () => {
    it("should parse valid CII XML", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
          <ExchangedDocument>
            <ID>INV-001</ID>
            <TypeCode>380</TypeCode>
            <IssueDateTime>
              <DateTimeString format="102">20240115</DateTimeString>
            </IssueDateTime>
          </ExchangedDocument>
        </CrossIndustryInvoice>`;
      
      const result = parseXml(xml);
      expect(result.format).toBe("CII");
      expect(result.parsed).toBeDefined();
    });

    it("should parse valid UBL XML", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
          <ID>INV-001</ID>
          <IssueDate>2024-01-15</IssueDate>
          <InvoiceTypeCode>380</InvoiceTypeCode>
          <DocumentCurrencyCode>EUR</DocumentCurrencyCode>
          <AccountingSupplierParty>
            <Party><PartyName><Name>Test Seller</Name></PartyName></Party>
          </AccountingSupplierParty>
          <AccountingCustomerParty>
            <Party><PartyName><Name>Test Buyer</Name></PartyName></Party>
          </AccountingCustomerParty>
          <LegalMonetaryTotal>
            <PayableAmount currencyID="EUR">100.00</PayableAmount>
          </LegalMonetaryTotal>
        </Invoice>`;
      
      const result = parseXml(xml);
      expect(result.format).toBe("UBL");
      expect(result.parsed).toBeDefined();
    });

    it("should return warnings for CII with missing sections", () => {
      const xml = `<?xml version="1.0"?>
        <CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
          <ExchangedDocument>
            <ID>INV-001</ID>
          </ExchangedDocument>
        </CrossIndustryInvoice>`;
      
      const result = parseXml(xml, true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should throw on invalid XML when validate is true", () => {
      const xml = `<?xml version="1.0"?><root><unclosed>`;
      let threw = false;
      try {
        parseXml(xml, true);
      } catch (e) {
        threw = e instanceof XmlValidationError;
      }
      expect(threw).toBe(true);
    });
  });

  describe("extractTextValue", () => {
    it("should extract text from string", () => {
      expect(extractTextValue("hello")).toBe("hello");
    });

    it("should extract text from number", () => {
      expect(extractTextValue(123)).toBe("123");
    });

    it("should extract #text property", () => {
      expect(extractTextValue({ "#text": "value" })).toBe("value");
    });

    it("should extract @_value property", () => {
      expect(extractTextValue({ "@_value": "value" })).toBe("value");
    });

    it("should return undefined for null/undefined", () => {
      expect(extractTextValue(null)).toBeUndefined();
      expect(extractTextValue(undefined)).toBeUndefined();
    });
  });

  describe("extractAmount", () => {
    it("should extract amount from string", () => {
      const result = extractAmount("100.50");
      expect(result?.amount).toBe(100.5);
    });

    it("should extract amount with currency", () => {
      const result = extractAmount({ "#text": "100.50", "@_currencyID": "EUR" });
      expect(result?.amount).toBe(100.5);
      expect(result?.currency).toBe("EUR");
    });

    it("should return undefined for invalid input", () => {
      expect(extractAmount(null)).toBeUndefined();
      expect(extractAmount("not-a-number")).toBeUndefined();
    });
  });

  describe("extractCiiDate", () => {
    it("should extract date in format 102 (YYYYMMDD)", () => {
      const dateTime = {
        DateTimeString: {
          "@_format": "102",
          "#text": "20240115"
        }
      };
      expect(extractCiiDate(dateTime)).toBe("2024-01-15");
    });

    it("should extract date in format 610 (YYYYMM)", () => {
      const dateTime = {
        DateTimeString: {
          "@_format": "610",
          "#text": "202401"
        }
      };
      expect(extractCiiDate(dateTime)).toBe("2024-01");
    });

    it("should return undefined for invalid input", () => {
      expect(extractCiiDate(null)).toBeUndefined();
      expect(extractCiiDate({})).toBeUndefined();
    });
  });
});
