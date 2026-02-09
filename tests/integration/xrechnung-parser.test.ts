import { describe, it, expect } from "bun:test";
import {
  parseXRechnung,
  parseXRechnungCii,
  parseXRechnungUbl,
  isXRechnungCii,
  isXRechnungUbl,
} from "@/src/server/parsers/xrechnung";
import {
  InvoiceParseError,
  XmlValidationError,
  UnsupportedFormatError,
} from "@/src/server/parsers/errors";

describe("XRechnung Parser", () => {
  // Sample CII XML
  const validCiiXml = `<?xml version="1.0" encoding="UTF-8"?>
    <CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
      <ExchangedDocument>
        <ID>XR-2024-001</ID>
        <TypeCode>380</TypeCode>
        <IssueDateTime>
          <DateTimeString format="102">20240115</DateTimeString>
        </IssueDateTime>
      </ExchangedDocument>
      <SupplyChainTradeTransaction>
        <ApplicableHeaderTradeAgreement>
          <SellerTradeParty>
            <Name>XRechnung Seller GmbH</Name>
          </SellerTradeParty>
          <BuyerTradeParty>
            <Name>XRechnung Buyer AG</Name>
          </BuyerTradeParty>
        </ApplicableHeaderTradeAgreement>
        <ApplicableHeaderTradeSettlement>
          <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
          <SpecifiedTradeSettlementHeaderMonetarySummation>
            <GrandTotalAmount currencyID="EUR">1190.00</GrandTotalAmount>
          </SpecifiedTradeSettlementHeaderMonetarySummation>
        </ApplicableHeaderTradeSettlement>
      </SupplyChainTradeTransaction>
    </CrossIndustryInvoice>`;

  // Sample UBL XML
  const validUblXml = `<?xml version="1.0" encoding="UTF-8"?>
    <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
      <cbc:ID>XR-2024-002</cbc:ID>
      <cbc:IssueDate>2024-01-15</cbc:IssueDate>
      <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
      <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
      <cac:AccountingSupplierParty>
        <cac:Party>
          <cac:PartyName>
            <cbc:Name>XRechnung Seller GmbH</cbc:Name>
          </cac:PartyName>
        </cac:Party>
      </cac:AccountingSupplierParty>
      <cac:AccountingCustomerParty>
        <cac:Party>
          <cac:PartyName>
            <cbc:Name>XRechnung Buyer AG</cbc:Name>
          </cac:PartyName>
        </cac:Party>
      </cac:AccountingCustomerParty>
      <cac:LegalMonetaryTotal>
        <cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>
      </cac:LegalMonetaryTotal>
    </Invoice>`;

  const invalidXml = `<?xml version="1.0"?><invalid>`;
  const unknownXml = `<?xml version="1.0"?><root><item>test</item></root>`;

  describe("parseXRechnung", () => {
    it("should auto-detect and parse CII format", async () => {
      const result = await parseXRechnung(Buffer.from(validCiiXml));
      
      expect(result.detectedFormat).toBe("XRECHNUNG_CII");
      expect(result.invoice.format).toBe("XRECHNUNG");
      expect(result.invoice.number).toBe("XR-2024-001");
      expect(result.invoice.supplier?.name).toBe("XRechnung Seller GmbH");
    });

    it("should auto-detect and parse UBL format", async () => {
      const result = await parseXRechnung(Buffer.from(validUblXml));
      
      expect(result.detectedFormat).toBe("XRECHNUNG_UBL");
      expect(result.invoice.format).toBe("XRECHNUNG");
      expect(result.invoice.number).toBe("XR-2024-002");
      expect(result.invoice.supplier?.name).toBe("XRechnung Seller GmbH");
    });

    it("should throw UnsupportedFormatError for unknown format", async () => {
      try {
        await parseXRechnung(Buffer.from(unknownXml));
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error instanceof UnsupportedFormatError).toBe(true);
      }
    });

    it("should throw XmlValidationError for invalid XML", async () => {
      try {
        await parseXRechnung(Buffer.from(invalidXml));
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error instanceof XmlValidationError).toBe(true);
      }
    });

    it("should include warnings when validation finds issues", async () => {
      // CII XML with missing optional sections
      const partialCii = `<?xml version="1.0"?>
        <CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
          <ExchangedDocument>
            <ID>PARTIAL</ID>
            <TypeCode>380</TypeCode>
            <IssueDateTime>
              <DateTimeString format="102">20240115</DateTimeString>
            </IssueDateTime>
          </ExchangedDocument>
          <SupplyChainTradeTransaction>
            <ApplicableHeaderTradeAgreement>
              <SellerTradeParty><Name>Test</Name></SellerTradeParty>
              <BuyerTradeParty><Name>Test</Name></BuyerTradeParty>
            </ApplicableHeaderTradeAgreement>
            <ApplicableHeaderTradeSettlement>
              <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
              <SpecifiedTradeSettlementHeaderMonetarySummation>
                <GrandTotalAmount>100.00</GrandTotalAmount>
              </SpecifiedTradeSettlementHeaderMonetarySummation>
            </ApplicableHeaderTradeSettlement>
          </SupplyChainTradeTransaction>
        </CrossIndustryInvoice>`;
      
      const result = await parseXRechnung(Buffer.from(partialCii));
      // Should parse successfully even with partial data
      expect(result.invoice.number).toBe("PARTIAL");
    });

    it("should respect strict mode", async () => {
      // This has warnings (missing some sections)
      const partialXml = `<?xml version="1.0"?>
        <CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
          <SupplyChainTradeTransaction>
            <ApplicableHeaderTradeAgreement>
              <SellerTradeParty><Name>Test</Name></SellerTradeParty>
              <BuyerTradeParty><Name>Test</Name></BuyerTradeParty>
            </ApplicableHeaderTradeAgreement>
          </SupplyChainTradeTransaction>
        </CrossIndustryInvoice>`;
      
      try {
        await parseXRechnung(Buffer.from(partialXml), { strict: true });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error instanceof InvoiceParseError).toBe(true);
      }
    });

    it("should skip validation when validate is false", async () => {
      const result = await parseXRechnung(Buffer.from(validCiiXml), { validate: false });
      expect(result.invoice).toBeDefined();
    });
  });

  describe("parseXRechnungCii", () => {
    it("should parse CII format", async () => {
      const result = await parseXRechnungCii(Buffer.from(validCiiXml));
      
      expect(result.detectedFormat).toBe("XRECHNUNG_CII");
      expect(result.invoice.number).toBe("XR-2024-001");
    });

    it("should throw on invalid XML", async () => {
      try {
        await parseXRechnungCii(Buffer.from(invalidXml));
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("parseXRechnungUbl", () => {
    it("should parse UBL format", async () => {
      const result = await parseXRechnungUbl(Buffer.from(validUblXml));
      
      expect(result.detectedFormat).toBe("XRECHNUNG_UBL");
      expect(result.invoice.number).toBe("XR-2024-002");
    });

    it("should throw on invalid XML", async () => {
      try {
        await parseXRechnungUbl(Buffer.from(invalidXml));
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("isXRechnungCii", () => {
    it("should detect CII format", () => {
      expect(isXRechnungCii(validCiiXml)).toBe(true);
      expect(isXRechnungCii(validUblXml)).toBe(false);
      expect(isXRechnungCii(unknownXml)).toBe(false);
    });

    it("should detect by namespace", () => {
      const ciiByNs = `<root xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">test</root>`;
      expect(isXRechnungCii(ciiByNs)).toBe(true);
    });
  });

  describe("isXRechnungUbl", () => {
    it("should detect UBL format", () => {
      expect(isXRechnungUbl(validUblXml)).toBe(true);
      expect(isXRechnungUbl(validCiiXml)).toBe(false);
      expect(isXRechnungUbl(unknownXml)).toBe(false);
    });

    it("should detect by xmlns attributes", () => {
      const ublByCbc = `<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"></Invoice>`;
      const ublByCac = `<Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"></Invoice>`;
      expect(isXRechnungUbl(ublByCbc)).toBe(true);
      expect(isXRechnungUbl(ublByCac)).toBe(true);
    });

    it("should not detect non-invoice UBL", () => {
      const nonInvoiceUbl = `<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"></CreditNote>`;
      expect(isXRechnungUbl(nonInvoiceUbl)).toBe(false);
    });
  });
});
