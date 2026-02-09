/**
 * XSD Schema definitions for e-invoice validation
 * These are simplified versions of the official schemas
 */

// CII (Cross Industry Invoice) Schema - Used by ZUGFeRD 2.3 and XRechnung CII
export const CII_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
           targetNamespace="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
           elementFormDefault="qualified">
  
  <xs:element name="CrossIndustryInvoice">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="ExchangedDocumentContext" type="rsm:ExchangedDocumentContextType"/>
        <xs:element name="ExchangedDocument" type="rsm:ExchangedDocumentType"/>
        <xs:element name="SupplyChainTradeTransaction" type="rsm:SupplyChainTradeTransactionType"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
  
  <xs:complexType name="ExchangedDocumentContextType">
    <xs:sequence>
      <xs:element name="BusinessProcessSpecifiedDocumentContextParameter" minOccurs="0">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ID" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="GuidelineSpecifiedDocumentContextParameter">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ID" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="ExchangedDocumentType">
    <xs:sequence>
      <xs:element name="ID" type="xs:string"/>
      <xs:element name="TypeCode" type="xs:string"/>
      <xs:element name="IssueDateTime" type="rsm:DateTimeType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="SupplyChainTradeTransactionType">
    <xs:sequence>
      <xs:element name="IncludedSupplyChainTradeLineItem" minOccurs="0" maxOccurs="unbounded" type="rsm:SupplyChainTradeLineItemType"/>
      <xs:element name="ApplicableHeaderTradeAgreement" type="rsm:HeaderTradeAgreementType"/>
      <xs:element name="ApplicableHeaderTradeDelivery" type="rsm:HeaderTradeDeliveryType"/>
      <xs:element name="ApplicableHeaderTradeSettlement" type="rsm:HeaderTradeSettlementType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="SupplyChainTradeLineItemType">
    <xs:sequence>
      <xs:element name="AssociatedDocumentLineDocument" minOccurs="0">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="LineID" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="SpecifiedTradeProduct" type="rsm:TradeProductType"/>
      <xs:element name="SpecifiedLineTradeAgreement" type="rsm:LineTradeAgreementType"/>
      <xs:element name="SpecifiedLineTradeDelivery" type="rsm:LineTradeDeliveryType"/>
      <xs:element name="SpecifiedLineTradeSettlement" type="rsm:LineTradeSettlementType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="TradeProductType">
    <xs:sequence>
      <xs:element name="Name" type="xs:string" minOccurs="0"/>
      <xs:element name="Description" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="LineTradeAgreementType">
    <xs:sequence>
      <xs:element name="NetPriceProductTradePrice" minOccurs="0">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ChargeAmount" type="rsm:AmountType"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="LineTradeDeliveryType">
    <xs:sequence>
      <xs:element name="BilledQuantity" type="rsm:QuantityType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="LineTradeSettlementType">
    <xs:sequence>
      <xs:element name="ApplicableTradeTax" minOccurs="0" maxOccurs="unbounded">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="TypeCode" type="xs:string"/>
            <xs:element name="CategoryCode" type="xs:string" minOccurs="0"/>
            <xs:element name="RateApplicablePercent" type="xs:decimal" minOccurs="0"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="SpecifiedTradeSettlementLineMonetarySummation">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="LineTotalAmount" type="rsm:AmountType"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="HeaderTradeAgreementType">
    <xs:sequence>
      <xs:element name="SellerTradeParty" type="rsm:TradePartyType"/>
      <xs:element name="BuyerTradeParty" type="rsm:TradePartyType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="HeaderTradeDeliveryType">
    <xs:sequence>
      <xs:element name="ActualDeliverySupplyChainEvent" minOccurs="0">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="OccurrenceDateTime" type="rsm:DateTimeType"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="HeaderTradeSettlementType">
    <xs:sequence>
      <xs:element name="InvoiceCurrencyCode" type="xs:string"/>
      <xs:element name="SpecifiedTradeSettlementHeaderMonetarySummation" type="rsm:TradeSettlementHeaderMonetarySummationType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="TradePartyType">
    <xs:sequence>
      <xs:element name="Name" type="xs:string"/>
      <xs:element name="PostalTradeAddress" minOccurs="0" type="rsm:TradeAddressType"/>
      <xs:element name="SpecifiedTaxRegistration" minOccurs="0" maxOccurs="unbounded">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ID" type="rsm:TaxIDType"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="TradeAddressType">
    <xs:sequence>
      <xs:element name="LineOne" type="xs:string" minOccurs="0"/>
      <xs:element name="CityName" type="xs:string" minOccurs="0"/>
      <xs:element name="PostcodeCode" type="xs:string" minOccurs="0"/>
      <xs:element name="CountryID" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="TradeSettlementHeaderMonetarySummationType">
    <xs:sequence>
      <xs:element name="LineTotalAmount" type="rsm:AmountType" minOccurs="0"/>
      <xs:element name="ChargeTotalAmount" type="rsm:AmountType" minOccurs="0"/>
      <xs:element name="AllowanceTotalAmount" type="rsm:AmountType" minOccurs="0"/>
      <xs:element name="TaxBasisTotalAmount" type="rsm:AmountType" minOccurs="0"/>
      <xs:element name="TaxTotalAmount" type="rsm:AmountType" minOccurs="0" maxOccurs="unbounded"/>
      <xs:element name="GrandTotalAmount" type="rsm:AmountType" minOccurs="0"/>
      <xs:element name="TotalPrepaidAmount" type="rsm:AmountType" minOccurs="0"/>
      <xs:element name="DuePayableAmount" type="rsm:AmountType" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="DateTimeType">
    <xs:sequence>
      <xs:element name="DateTimeString">
        <xs:complexType>
          <xs:simpleContent>
            <xs:extension base="xs:string">
              <xs:attribute name="format" type="xs:string" use="required"/>
            </xs:extension>
          </xs:simpleContent>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="AmountType">
    <xs:simpleContent>
      <xs:extension base="xs:decimal">
        <xs:attribute name="currencyID" type="xs:string" use="optional"/>
      </xs:extension>
    </xs:simpleContent>
  </xs:complexType>
  
  <xs:complexType name="QuantityType">
    <xs:simpleContent>
      <xs:extension base="xs:decimal">
        <xs:attribute name="unitCode" type="xs:string" use="optional"/>
      </xs:extension>
    </xs:simpleContent>
  </xs:complexType>
  
  <xs:complexType name="TaxIDType">
    <xs:simpleContent>
      <xs:extension base="xs:string">
        <xs:attribute name="schemeID" type="xs:string" use="optional"/>
      </xs:extension>
    </xs:simpleContent>
  </xs:complexType>
  
</xs:schema>`;

// UBL Invoice Schema - Used by XRechnung UBL
export const UBL_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
           xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
           elementFormDefault="qualified">
  
  <xs:element name="Invoice">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="ID" type="xs:string"/>
        <xs:element name="IssueDate" type="xs:date"/>
        <xs:element name="DueDate" type="xs:date" minOccurs="0"/>
        <xs:element name="InvoiceTypeCode" type="xs:string"/>
        <xs:element name="DocumentCurrencyCode" type="xs:string"/>
        <xs:element name="AccountingSupplierParty" type="SupplierPartyType"/>
        <xs:element name="AccountingCustomerParty" type="CustomerPartyType"/>
        <xs:element name="LegalMonetaryTotal" type="MonetaryTotalType"/>
        <xs:element name="InvoiceLine" type="InvoiceLineType" minOccurs="0" maxOccurs="unbounded"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
  
  <xs:complexType name="SupplierPartyType">
    <xs:sequence>
      <xs:element name="Party" type="PartyType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="CustomerPartyType">
    <xs:sequence>
      <xs:element name="Party" type="PartyType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="PartyType">
    <xs:sequence>
      <xs:element name="PartyName" minOccurs="0">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="Name" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="PostalAddress" minOccurs="0" type="AddressType"/>
      <xs:element name="PartyTaxScheme" minOccurs="0" maxOccurs="unbounded" type="PartyTaxSchemeType"/>
      <xs:element name="PartyLegalEntity" minOccurs="0">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="RegistrationName" type="xs:string" minOccurs="0"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="AddressType">
    <xs:sequence>
      <xs:element name="StreetName" type="xs:string" minOccurs="0"/>
      <xs:element name="CityName" type="xs:string" minOccurs="0"/>
      <xs:element name="PostalZone" type="xs:string" minOccurs="0"/>
      <xs:element name="Country" minOccurs="0">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="IdentificationCode" type="xs:string" minOccurs="0"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="PartyTaxSchemeType">
    <xs:sequence>
      <xs:element name="CompanyID" type="xs:string" minOccurs="0"/>
      <xs:element name="TaxScheme" minOccurs="0">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ID" type="xs:string" minOccurs="0"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="MonetaryTotalType">
    <xs:sequence>
      <xs:element name="LineExtensionAmount" type="AmountType" minOccurs="0"/>
      <xs:element name="TaxExclusiveAmount" type="AmountType" minOccurs="0"/>
      <xs:element name="TaxInclusiveAmount" type="AmountType" minOccurs="0"/>
      <xs:element name="AllowanceTotalAmount" type="AmountType" minOccurs="0"/>
      <xs:element name="ChargeTotalAmount" type="AmountType" minOccurs="0"/>
      <xs:element name="PrepaidAmount" type="AmountType" minOccurs="0"/>
      <xs:element name="PayableRoundingAmount" type="AmountType" minOccurs="0"/>
      <xs:element name="PayableAmount" type="AmountType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="InvoiceLineType">
    <xs:sequence>
      <xs:element name="ID" type="xs:string"/>
      <xs:element name="InvoicedQuantity" type="QuantityType"/>
      <xs:element name="LineExtensionAmount" type="AmountType"/>
      <xs:element name="Item" type="ItemType"/>
      <xs:element name="Price" type="PriceType" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="ItemType">
    <xs:sequence>
      <xs:element name="Description" type="xs:string" minOccurs="0"/>
      <xs:element name="Name" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="PriceType">
    <xs:sequence>
      <xs:element name="PriceAmount" type="AmountType"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="AmountType">
    <xs:simpleContent>
      <xs:extension base="xs:decimal">
        <xs:attribute name="currencyID" type="xs:string" use="optional"/>
      </xs:extension>
    </xs:simpleContent>
  </xs:complexType>
  
  <xs:complexType name="QuantityType">
    <xs:simpleContent>
      <xs:extension base="xs:decimal">
        <xs:attribute name="unitCode" type="xs:string" use="optional"/>
      </xs:extension>
    </xs:simpleContent>
  </xs:complexType>
  
</xs:schema>`;

/** ZUGFeRD 2.3 profile identifiers */
export const ZUGFERD_PROFILES = {
  MINIMUM: "urn:factur-x.eu:1p0:minimum",
  BASIC_WL: "urn:factur-x.eu:1p0:basicwl",
  BASIC: "urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic",
  EN16931: "urn:cen.eu:en16931:2017",
  EXTENDED: "urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended",
  XRECHNUNG: "urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_1.2",
} as const;

/** XRechnung profile identifiers */
export const XRECHNUNG_PROFILES = {
  CII_2_3: "urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_2.3",
  UBL_2_3: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
} as const;
