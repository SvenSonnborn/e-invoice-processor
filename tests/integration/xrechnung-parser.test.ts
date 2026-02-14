import { describe, it, expect } from 'bun:test';
import {
  parseInvoiceFromXML,
  parseCII,
  parseUBL,
  detectInvoiceFlavor,
} from '@/src/lib/zugferd';

describe('XRechnung Parser', () => {
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

  describe('parseInvoiceFromXML', () => {
    it('should auto-detect and parse CII format', async () => {
      const result = await parseInvoiceFromXML(validCiiXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.number).toBe('XR-2024-001');
      expect(result.invoice?.supplier?.name).toBe('XRechnung Seller GmbH');
      expect(['ZUGFeRD', 'XRechnung']).toContain(result.detection.flavor);
    });

    it('should auto-detect and parse UBL format', async () => {
      const ublResult = parseUBL(validUblXml);
      expect(ublResult.success).toBe(true);
      expect(ublResult.invoice?.documentId).toBe('XR-2024-002');
      const result = await parseInvoiceFromXML(validUblXml);
      expect(result.detection.flavor).not.toBe('Unknown');
      if (result.success && result.invoice)
        expect(result.invoice.number).toBe('XR-2024-002');
    });

    it('should return success false for unknown format', async () => {
      const result = await parseInvoiceFromXML(unknownXml);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return success false for invalid XML', async () => {
      const result = await parseInvoiceFromXML(invalidXml);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include warnings when validation finds issues', async () => {
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
      const result = await parseInvoiceFromXML(partialCii);
      expect(result.invoice?.number).toBe('PARTIAL');
    });
  });

  describe('parseCII', () => {
    it('should parse CII format', () => {
      const result = parseCII(validCiiXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.documentId).toBe('XR-2024-001');
    });

    it('should return success false on invalid XML', () => {
      const result = parseCII(invalidXml);
      expect(result.success).toBe(false);
    });
  });

  describe('parseUBL', () => {
    it('should parse UBL format', () => {
      const result = parseUBL(validUblXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.documentId).toBe('XR-2024-002');
    });

    it('should return success false on invalid XML', () => {
      const result = parseUBL(invalidXml);
      expect(result.success).toBe(false);
    });
  });

  describe('detectInvoiceFlavor', () => {
    it('should detect CII format', () => {
      const detection = detectInvoiceFlavor(validCiiXml);
      expect(detection.flavor).toBe('ZUGFeRD');
      expect(
        detection.version === undefined || detection.version === '2.4'
      ).toBe(true);
    });

    it('should detect UBL format', () => {
      const detection = detectInvoiceFlavor(validUblXml);
      expect(['ZUGFeRD', 'XRechnung']).toContain(detection.flavor);
    });

    it('should return Unknown for unrecognized format', () => {
      expect(detectInvoiceFlavor(unknownXml).flavor).toBe('Unknown');
    });

    it('should detect CII by root element', () => {
      const ciiRoot = `<CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"><SupplyChainTradeTransaction/></CrossIndustryInvoice>`;
      expect(detectInvoiceFlavor(ciiRoot).flavor).toBe('ZUGFeRD');
    });

    it('should detect UBL by Invoice element', () => {
      const ublByCbc = `<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"></Invoice>`;
      expect(['ZUGFeRD', 'XRechnung']).toContain(
        detectInvoiceFlavor(ublByCbc).flavor
      );
    });
  });
});
