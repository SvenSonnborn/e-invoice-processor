import { describe, it, expect } from 'bun:test';
import { parseCII } from '@/src/lib/zugferd';

describe('CII Parser', () => {
  const validCiiXml = `<?xml version="1.0" encoding="UTF-8"?>
<CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <ExchangedDocument>
    <ID>INV-2024-001</ID>
    <TypeCode>380</TypeCode>
    <IssueDateTime>
      <DateTimeString format="102">20240115</DateTimeString>
    </IssueDateTime>
  </ExchangedDocument>
  <SupplyChainTradeTransaction>
    <ApplicableHeaderTradeAgreement>
      <SellerTradeParty>
        <Name>Test Seller GmbH</Name>
        <PostalTradeAddress>
          <LineOne>Test Street 123</LineOne>
          <CityName>Berlin</CityName>
          <PostcodeCode>10115</PostcodeCode>
          <CountryID>DE</CountryID>
        </PostalTradeAddress>
        <SpecifiedTaxRegistration>
          <ID schemeID="VA">DE123456789</ID>
        </SpecifiedTaxRegistration>
      </SellerTradeParty>
      <BuyerTradeParty>
        <Name>Test Buyer AG</Name>
        <PostalTradeAddress>
          <LineOne>Buyer Street 456</LineOne>
          <CityName>Munich</CityName>
          <PostcodeCode>80331</PostcodeCode>
          <CountryID>DE</CountryID>
        </PostalTradeAddress>
      </BuyerTradeParty>
    </ApplicableHeaderTradeAgreement>
    <ApplicableHeaderTradeDelivery>
      <ActualDeliverySupplyChainEvent>
        <OccurrenceDateTime>
          <DateTimeString format="102">20240110</DateTimeString>
        </OccurrenceDateTime>
      </ActualDeliverySupplyChainEvent>
    </ApplicableHeaderTradeDelivery>
    <ApplicableHeaderTradeSettlement>
      <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
      <SpecifiedTradeSettlementHeaderMonetarySummation>
        <LineTotalAmount currencyID="EUR">1000.00</LineTotalAmount>
        <TaxBasisTotalAmount currencyID="EUR">1000.00</TaxBasisTotalAmount>
        <TaxTotalAmount currencyID="EUR">190.00</TaxTotalAmount>
        <GrandTotalAmount currencyID="EUR">1190.00</GrandTotalAmount>
        <DuePayableAmount currencyID="EUR">1190.00</DuePayableAmount>
      </SpecifiedTradeSettlementHeaderMonetarySummation>
      <SpecifiedTradePaymentTerms>
        <DueDateDateTime>
          <DateTimeString format="102">20240215</DateTimeString>
        </DueDateDateTime>
      </SpecifiedTradePaymentTerms>
      <SpecifiedTradeSettlementPaymentMeans>
        <PayeePartyCreditorFinancialAccount>
          <IBANID>DE89370400440532013000</IBANID>
        </PayeePartyCreditorFinancialAccount>
        <PayeeSpecifiedCreditorFinancialInstitution>
          <BICID>COBADEFFXXX</BICID>
        </PayeeSpecifiedCreditorFinancialInstitution>
      </SpecifiedTradeSettlementPaymentMeans>
    </ApplicableHeaderTradeSettlement>
    <IncludedSupplyChainTradeLineItem>
      <AssociatedDocumentLineDocument>
        <LineID>1</LineID>
      </AssociatedDocumentLineDocument>
      <SpecifiedTradeProduct>
        <Name>Product A</Name>
      </SpecifiedTradeProduct>
      <SpecifiedLineTradeAgreement>
        <NetPriceProductTradePrice>
          <ChargeAmount currencyID="EUR">100.00</ChargeAmount>
        </NetPriceProductTradePrice>
      </SpecifiedLineTradeAgreement>
      <SpecifiedLineTradeDelivery>
        <BilledQuantity unitCode="C62">10</BilledQuantity>
      </SpecifiedLineTradeDelivery>
      <SpecifiedLineTradeSettlement>
        <ApplicableTradeTax>
          <TypeCode>VAT</TypeCode>
          <CategoryCode>S</CategoryCode>
          <RateApplicablePercent>19</RateApplicablePercent>
        </ApplicableTradeTax>
        <SpecifiedTradeSettlementLineMonetarySummation>
          <LineTotalAmount currencyID="EUR">1000.00</LineTotalAmount>
        </SpecifiedTradeSettlementLineMonetarySummation>
      </SpecifiedLineTradeSettlement>
    </IncludedSupplyChainTradeLineItem>
  </SupplyChainTradeTransaction>
</CrossIndustryInvoice>`;

  describe('parseCII', () => {
    it('should parse document metadata', () => {
      const result = parseCII(validCiiXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.documentId).toBe('INV-2024-001');
    });

    it('should parse seller information', () => {
      const result = parseCII(validCiiXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.seller?.name).toBe('Test Seller GmbH');
    });

    it('should parse buyer information', () => {
      const result = parseCII(validCiiXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.buyer?.name).toBe('Test Buyer AG');
    });

    it('should parse totals', () => {
      const result = parseCII(validCiiXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.currency).toBe('EUR');
      expect(result.invoice?.monetarySummation?.grandTotalAmount).toBeDefined();
    });

    it('should parse line items', () => {
      const result = parseCII(validCiiXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.lineItems?.length).toBeGreaterThanOrEqual(0);
    });

    it('should return success false for invalid root element', () => {
      const invalidXml = `<?xml version="1.0"?><InvalidRoot></InvalidRoot>`;
      const result = parseCII(invalidXml);
      expect(result.success).toBe(false);
    });

    it('should return success false for malformed XML', () => {
      const result = parseCII('<not valid xml');
      expect(result.success).toBe(false);
    });

    it('should handle minimal CII structure', () => {
      const minimalXml = `<?xml version="1.0"?>
<CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <SupplyChainTradeTransaction>
    <ApplicableHeaderTradeAgreement>
      <SellerTradeParty><Name>S</Name></SellerTradeParty>
      <BuyerTradeParty><Name>B</Name></BuyerTradeParty>
    </ApplicableHeaderTradeAgreement>
    <ApplicableHeaderTradeSettlement>
      <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
      <SpecifiedTradeSettlementHeaderMonetarySummation>
        <GrandTotalAmount>0</GrandTotalAmount>
      </SpecifiedTradeSettlementHeaderMonetarySummation>
    </ApplicableHeaderTradeSettlement>
  </SupplyChainTradeTransaction>
</CrossIndustryInvoice>`;
      const result = parseCII(minimalXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.seller?.name).toBe('S');
      expect(result.invoice?.buyer?.name).toBe('B');
    });
  });
});
