/**
 * Tests for ZUGFeRD Parser
 */

import { describe, it, expect } from 'bun:test';
import {
  isPDF,
  parseCII,
  parseUBL,
  detectInvoiceFlavor,
  validateXML,
  parseInvoice,
  parseInvoiceFromXML,
  isValidEInvoice,
  mapToInvoiceModel,
} from '@/src/lib/zugferd';

// Test data
const sampleCIIXML = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:extended</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>INV-2024-001</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">20240115</udt:DateTimeString>
    </ram:IssueDateTime>
    <ram:IncludedNote>
      <ram:Content>Test invoice note</ram:Content>
    </ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>1</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>Product A</ram:Name>
        <ram:Description>Description of Product A</ram:Description>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>100.00</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">2.0000</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>200.00</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:ID>S12345</ram:ID>
        <ram:Name>Test Seller GmbH</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:TradingBusinessName>Test Seller GmbH</ram:TradingBusinessName>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>12345</ram:PostcodeCode>
          <ram:CityName>Berlin</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">DE123456789</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:ID>B67890</ram:ID>
        <ram:Name>Test Buyer AG</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>54321</ram:PostcodeCode>
          <ram:CityName>Munich</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">20240120</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>38.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>200.00</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Payment within 30 days</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">20240214</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>200.00</ram:LineTotalAmount>
        <ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount>
        <ram:AllowanceTotalAmount>0.00</ram:AllowanceTotalAmount>
        <ram:TaxBasisTotalAmount>200.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">38.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>238.00</ram:GrandTotalAmount>
        <ram:DuePayableAmount>238.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

const sampleUBLXML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INV-UBL-001</cbc:ID>
  <cbc:IssueDate>2024-01-15</cbc:IssueDate>
  <cbc:DueDate>2024-02-14</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:Name>UBL Seller GmbH</cbc:Name>
      <cac:PostalAddress>
        <cbc:StreetName>Test Street 1</cbc:StreetName>
        <cbc:CityName>Hamburg</cbc:CityName>
        <cbc:PostalZone>20095</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>DE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:Name>UBL Customer AG</cbc:Name>
      <cac:PostalAddress>
        <cbc:StreetName>Customer Street 5</cbc:StreetName>
        <cbc:CityName>Cologne</cbc:CityName>
        <cbc:PostalZone>50667</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>DE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">150.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">150.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">178.50</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">178.50</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">150.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Service B</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">150.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

const invalidXML = `<?xml version="1.0" encoding="UTF-8"?>
<InvalidRoot>
  <SomeField>value</SomeField>
</InvalidRoot>`;

describe('ZUGFeRD Parser', () => {
  describe('isPDF', () => {
    it('should return true for PDF buffer', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4...');
      expect(isPDF(pdfBuffer)).toBe(true);
    });

    it('should return false for non-PDF buffer', () => {
      const xmlBuffer = Buffer.from('<?xml version="1.0"?>');
      expect(isPDF(xmlBuffer)).toBe(false);
    });

    it('should return false for empty buffer', () => {
      const emptyBuffer = Buffer.from('');
      expect(isPDF(emptyBuffer)).toBe(false);
    });
  });

  describe('detectInvoiceFlavor', () => {
    it('should detect CII format', () => {
      const result = detectInvoiceFlavor(sampleCIIXML);
      expect(result.flavor).toBe('ZUGFeRD');
    });

    it('should detect UBL format', () => {
      const result = detectInvoiceFlavor(sampleUBLXML);
      expect(result.flavor).toBe('ZUGFeRD'); // UBL without XRechnung customization
    });

    it('should return Unknown for invalid XML', () => {
      const result = detectInvoiceFlavor(invalidXML);
      expect(result.flavor).toBe('Unknown');
    });
  });

  describe('parseCII', () => {
    it('should parse valid CII XML', () => {
      const result = parseCII(sampleCIIXML);
      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
      expect(result.invoice?.documentId).toBe('INV-2024-001');
      expect(result.invoice?.seller?.name).toBe('Test Seller GmbH');
      expect(result.invoice?.buyer?.name).toBe('Test Buyer AG');
    });

    it('should parse line items correctly', () => {
      const result = parseCII(sampleCIIXML);
      expect(result.success).toBe(true);
      expect(result.invoice?.lineItems.length).toBeGreaterThan(0);
      expect(result.invoice?.lineItems[0].name).toBe('Product A');
    });

    it('should parse monetary totals', () => {
      const result = parseCII(sampleCIIXML);
      expect(result.success).toBe(true);
      // XMLParser with parseTagValue: true converts "238.00" to number 238, then String(238) = "238"
      expect(result.invoice?.monetarySummation.grandTotalAmount).toBe('238');
      expect(result.invoice?.currency).toBe('EUR');
    });

    it('should return error for invalid XML', () => {
      const result = parseCII(invalidXML);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseUBL', () => {
    it('should parse valid UBL XML', () => {
      const result = parseUBL(sampleUBLXML);
      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
      expect(result.invoice?.documentId).toBe('INV-UBL-001');
      expect(result.invoice?.seller?.name).toBe('UBL Seller GmbH');
      expect(result.invoice?.buyer?.name).toBe('UBL Customer AG');
    });

    it('should parse totals correctly', () => {
      const result = parseUBL(sampleUBLXML);
      expect(result.success).toBe(true);
      // UBL elements with attributes (currencyID) are parsed as objects with #text as a number
      const amount = Number(result.invoice?.monetarySummation.grandTotalAmount);
      expect(Math.abs(amount - 178.5) < 0.01).toBe(true);
    });

    it('should return error for invalid XML', () => {
      const result = parseUBL(invalidXML);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseInvoiceFromXML', () => {
    it('should parse CII XML and return full result', async () => {
      const result = await parseInvoiceFromXML(sampleCIIXML);
      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
      expect(result.detection.flavor).toBe('ZUGFeRD');
      expect(result.validation).toBeDefined();
    });

    it('should parse UBL XML and return full result', async () => {
      const result = await parseInvoiceFromXML(sampleUBLXML);
      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
    });

    it('should return errors for invalid XML', async () => {
      const result = await parseInvoiceFromXML('<invalid');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseInvoice', () => {
    it('should parse XML buffer', async () => {
      const buffer = Buffer.from(sampleCIIXML);
      const result = await parseInvoice(buffer, 'application/xml');
      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
    });

    it('should detect and parse XML without mime type', async () => {
      const buffer = Buffer.from(sampleCIIXML);
      const result = await parseInvoice(buffer);
      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
    });
  });

  describe('validateXML', () => {
    it('should validate well-formed CII XML', async () => {
      const result = await validateXML(sampleCIIXML, 'ZUGFeRD');
      // Should be well-formed, but schema validation may have warnings
      expect(result.errors.length).toBe(0); // No critical errors for valid CII
    });

    it('should return errors for malformed XML', async () => {
      const result = await validateXML('<invalid xml', 'ZUGFeRD');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('mapToInvoiceModel', () => {
    it('should map parsed invoice to Invoice model', () => {
      const parseResult = parseCII(sampleCIIXML);
      expect(parseResult.success).toBe(true);
      expect(parseResult.invoice).toBeDefined();

      const invoice = mapToInvoiceModel(parseResult.invoice!);
      expect(invoice.id).toBeDefined();
      expect(invoice.format).toBe('ZUGFERD');
      expect(invoice.number).toBe('INV-2024-001');
      expect(invoice.supplier?.name).toBe('Test Seller GmbH');
      expect(invoice.customer?.name).toBe('Test Buyer AG');
      expect(invoice.totals?.currency).toBe('EUR');
      expect(invoice.totals?.grossAmount).toBe('238');
    });
  });

  describe('isValidEInvoice', () => {
    it('should return valid for good CII', async () => {
      const buffer = Buffer.from(sampleCIIXML);
      const result = await isValidEInvoice(buffer);
      expect(result.valid).toBe(true);
      expect(result.flavor).toBe('ZUGFeRD');
    });

    it('should return invalid for bad input', async () => {
      const buffer = Buffer.from('not an invoice');
      const result = await isValidEInvoice(buffer);
      expect(result.valid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty XML', async () => {
      const result = await parseInvoiceFromXML('');
      expect(result.success).toBe(false);
    });

    it('should handle XML with special characters', () => {
      const xmlWithSpecialChars = sampleCIIXML.replace(
        'Test Seller GmbH',
        'Test Seller GmbH & Co. KG'
      );
      const result = parseCII(xmlWithSpecialChars);
      expect(result.success).toBe(true);
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalCII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>MIN-001</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">20240115</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>Minimal Seller</ram:Name>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>Minimal Buyer</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:GrandTotalAmount>100.00</ram:GrandTotalAmount>
        <ram:DuePayableAmount>100.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

      const result = parseCII(minimalCII);
      expect(result.success).toBe(true);
      expect(result.invoice?.documentId).toBe('MIN-001');
    });
  });
});
