import { describe, it, expect } from "bun:test";
import { detectInvoiceFlavor, getValidationInfo, validateXML } from "@/src/lib/zugferd";

describe("Format detection and validation", () => {
  const ciiXml = `<?xml version="1.0"?>
<CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <ExchangedDocumentContext><GuidelineSpecifiedDocumentContextParameter><ID>urn:ferd:CrossIndustryInvoice:ver2p3:basic</ID></GuidelineSpecifiedDocumentContextParameter></ExchangedDocumentContext>
  <ExchangedDocument><ID>X</ID><TypeCode>380</TypeCode><IssueDateTime><DateTimeString format="102">20240101</DateTimeString></IssueDateTime></ExchangedDocument>
  <SupplyChainTradeTransaction>
    <ApplicableHeaderTradeAgreement>
      <SellerTradeParty><Name>S</Name></SellerTradeParty>
      <BuyerTradeParty><Name>B</Name></BuyerTradeParty>
    </ApplicableHeaderTradeAgreement>
    <ApplicableHeaderTradeSettlement>
      <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
      <SpecifiedTradeSettlementHeaderMonetarySummation><GrandTotalAmount>0</GrandTotalAmount></SpecifiedTradeSettlementHeaderMonetarySummation>
    </ApplicableHeaderTradeSettlement>
  </SupplyChainTradeTransaction>
</CrossIndustryInvoice>`;

  const ublXml = `<?xml version="1.0"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>123</cbc:ID>
  <cbc:IssueDate>2024-01-01</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party></cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="EUR">0</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;

  const unknownXml = `<?xml version="1.0"?><root><test/></root>`;

  describe("detectInvoiceFlavor", () => {
    it("should detect CII format", () => {
      expect(detectInvoiceFlavor(ciiXml).flavor).toBe("ZUGFeRD");
      expect(detectInvoiceFlavor(ciiXml).version).toBe("2.3");
    });

    it("should detect UBL format", () => {
      const detection = detectInvoiceFlavor(ublXml);
      expect(["ZUGFeRD", "XRechnung"]).toContain(detection.flavor);
    });

    it("should return Unknown for unrecognized format", () => {
      expect(detectInvoiceFlavor(unknownXml).flavor).toBe("Unknown");
    });
  });

  describe("getValidationInfo", () => {
    it("should return flavor and version for CII", () => {
      const info = getValidationInfo(ciiXml);
      expect(info.flavor).toBe("ZUGFeRD");
      expect(info.version).toBe("2.3");
    });

    it("should return flavor for UBL", () => {
      const info = getValidationInfo(ublXml);
      expect(info.flavor).toBe("ZUGFeRD");
    });

    it("should return Unknown for invalid XML", () => {
      expect(getValidationInfo("not xml").flavor).toBe("Unknown");
    });
  });

  describe("validateXML", () => {
    it("should return valid for well-formed CII with required fields", async () => {
      const result = await validateXML(ciiXml, "ZUGFeRD");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid for malformed XML", async () => {
      const result = await validateXML("<?xml version=\"1.0\"?><root><item>test</root>", "ZUGFeRD");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
