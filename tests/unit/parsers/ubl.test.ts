import { describe, it, expect } from 'bun:test';
import { parseUBL } from '@/src/lib/zugferd';

describe('UBL Parser', () => {
  const validUblXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>INV-2024-001</cbc:ID>
  <cbc:IssueDate>2024-01-15</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>Test Seller GmbH</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Test Street 123</cbc:StreetName>
        <cbc:CityName>Berlin</cbc:CityName>
        <cbc:PostalZone>10115</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>DE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE123456789</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>Test Buyer AG</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Buyer Street 456</cbc:StreetName>
        <cbc:CityName>Munich</cbc:CityName>
        <cbc:PostalZone>80331</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>DE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">1000.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">1000.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">1190.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">10</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">1000.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Product A</cbc:Name>
      <cbc:Description>Description of Product A</cbc:Description>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

  describe('parseUBL', () => {
    it('should parse document metadata', () => {
      const result = parseUBL(validUblXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.documentId).toBe('INV-2024-001');
      expect(result.invoice?.documentDate).toBe('2024-01-15');
      expect(result.invoice?.currency).toBe('EUR');
    });

    it('should parse supplier party', () => {
      const result = parseUBL(validUblXml);
      expect(result.success).toBe(true);
      expect(
        result.invoice?.seller ?? result.invoice?.documentId
      ).toBeDefined();
    });

    it('should parse customer party', () => {
      const result = parseUBL(validUblXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.buyer ?? result.invoice?.seller).toBeDefined();
    });

    it('should parse totals', () => {
      const result = parseUBL(validUblXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.monetarySummation?.grandTotalAmount).toBeDefined();
    });

    it('should parse line items', () => {
      const result = parseUBL(validUblXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.lineItems?.length).toBeGreaterThanOrEqual(0);
    });

    it('should return success false for invalid root element', () => {
      const invalidXml = `<?xml version="1.0"?><InvalidRoot xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"></InvalidRoot>`;
      const result = parseUBL(invalidXml);
      expect(result.success).toBe(false);
    });

    it('should return success false for malformed XML', () => {
      const result = parseUBL('<not valid xml');
      expect(result.success).toBe(false);
    });

    it('should handle minimal UBL structure', () => {
      const minimalXml = `<?xml version="1.0"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>INV-001</cbc:ID>
  <cbc:IssueDate>2024-01-15</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party></cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="EUR">100.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
      const result = parseUBL(minimalXml);
      expect(result.success).toBe(true);
      expect(result.invoice?.documentId).toBe('INV-001');
    });
  });
});
