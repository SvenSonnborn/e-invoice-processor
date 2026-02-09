/**
 * XRechnung Parser - Parses CII (Cross Industry Invoice) and UBL formats
 */

import { XMLParser } from 'fast-xml-parser';
import { 
  ZUGFeRDInvoice, 
  ZUGFeRDParty, 
  ZUGFeRDTradeLineItem, 
  ZUGFeRDTax,
  ZUGFeRDMonetarySummation,
  ZUGFeRDPaymentTerms,
  ZUGFeRDMetaData,
  ParsedInvoiceResult,
  InvoiceDetectionResult,
  InvoiceFlavor
} from './types';

export class XRechnungParserError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'XRechnungParserError';
  }
}

// XML Parser options
const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  removeNSPrefix: false,
};

export function detectInvoiceFlavor(xmlContent: string): InvoiceDetectionResult {
  const parser = new XMLParser({ ...xmlParserOptions, stopNodes: ['*'] });
  
  try {
    const parsed = parser.parse(xmlContent);
    
    if (parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice) {
      return { flavor: 'ZUGFeRD', version: extractVersion(parsed, 'cii'), profile: extractProfile(parsed, 'cii') };
    }
    
    if (parsed['ubl:Invoice'] || parsed.Invoice) {
      const customizationId = extractUBLCustomizationId(parsed);
      if (customizationId?.toLowerCase().includes('xrechnung')) {
        return { flavor: 'XRechnung', version: extractVersion(parsed, 'ubl'), profile: customizationId };
      }
      return { flavor: 'ZUGFeRD', version: extractVersion(parsed, 'ubl'), profile: customizationId };
    }
    
    return { flavor: 'Unknown' };
  } catch {
    return { flavor: 'Unknown' };
  }
}

export function parseCII(xmlContent: string): ParsedInvoiceResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const parser = new XMLParser(xmlParserOptions);
    const parsed = parser.parse(xmlContent);
    
    const cii = parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice;
    
    if (!cii) {
      return { success: false, errors: ['Invalid CII format: Root element not found'], warnings };
    }

    const supplyChainTrade = cii['rsm:SupplyChainTradeTransaction'] || cii.SupplyChainTradeTransaction;
    
    if (!supplyChainTrade) {
      return { success: false, errors: ['Invalid CII format: SupplyChainTradeTransaction not found'], warnings };
    }

    const invoice = parseCIIStructure(cii, supplyChainTrade, errors, warnings);
    return { success: errors.length === 0, invoice, errors, warnings };
  } catch (error) {
    return { success: false, errors: [`Failed to parse CII XML: ${error instanceof Error ? error.message : 'Unknown error'}`], warnings };
  }
}

export function parseUBL(xmlContent: string): ParsedInvoiceResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const parser = new XMLParser(xmlParserOptions);
    const parsed = parser.parse(xmlContent);
    
    const invoice = parsed['ubl:Invoice'] || parsed.Invoice;
    
    if (!invoice) {
      return { success: false, errors: ['Invalid UBL format: Root element not found'], warnings };
    }

    const parsedInvoice = parseUBLStructure(invoice, errors, warnings);
    return { success: errors.length === 0, invoice: parsedInvoice, errors, warnings };
  } catch (error) {
    return { success: false, errors: [`Failed to parse UBL XML: ${error instanceof Error ? error.message : 'Unknown error'}`], warnings };
  }
}

function parseCIIStructure(cii: Record<string, unknown>, supplyChainTrade: Record<string, unknown>, errors: string[], warnings: string[]): ZUGFeRDInvoice {
  const header = cii['rsm:ExchangedDocument'] || cii.ExchangedDocument;
  const agreement = supplyChainTrade['ram:ApplicableHeaderTradeAgreement'] || supplyChainTrade.ApplicableHeaderTradeAgreement;
  const delivery = supplyChainTrade['ram:ApplicableHeaderTradeDelivery'] || supplyChainTrade.ApplicableHeaderTradeDelivery;
  const settlement = supplyChainTrade['ram:ApplicableHeaderTradeSettlement'] || supplyChainTrade.ApplicableHeaderTradeSettlement;
  
  const metadata: ZUGFeRDMetaData = { xmlVersion: '2.3', profile: extractProfile(cii, 'cii'), flavor: 'EXTENDED' };
  const invoice: ZUGFeRDInvoice = { metadata, lineItems: [], taxes: [], monetarySummation: {} };

  if (header) {
    invoice.documentId = getTextContent(header['ram:ID'] || header.ID);
    invoice.documentType = getTextContent(header['ram:TypeCode'] || header.TypeCode);
    invoice.documentDate = getDateContent(header['ram:IssueDateTime'] || header.IssueDateTime);
    invoice.notes = extractNotes(header['ram:IncludedNote'] || header.IncludedNote);
  }

  if (agreement) {
    invoice.seller = parseCIIParty(agreement['ram:SellerTradeParty'] || agreement.SellerTradeParty);
    invoice.buyer = parseCIIParty(agreement['ram:BuyerTradeParty'] || agreement.BuyerTradeParty);
    invoice.orderReference = getTextContent(agreement['ram:BuyerOrderReferencedDocument']?.['ram:IssuerAssignedID'] || agreement.BuyerOrderReferencedDocument?.IssuerAssignedID);
    invoice.contractReference = getTextContent(agreement['ram:ContractReferencedDocument']?.['ram:IssuerAssignedID'] || agreement.ContractReferencedDocument?.IssuerAssignedID);
  }

  if (delivery) {
    invoice.deliveryDate = getDateContent(delivery['ram:ActualDeliverySupplyChainEvent']?.['ram:OccurrenceDateTime'] || delivery.ActualDeliverySupplyChainEvent?.OccurrenceDateTime);
  }

  if (settlement) {
    invoice.currency = getTextContent(settlement['ram:InvoiceCurrencyCode'] || settlement.InvoiceCurrencyCode);
    invoice.paymentTerms = parsePaymentTerms(settlement);
    invoice.paymentMeansCode = getTextContent(settlement['ram:SpecifiedTradeSettlementPaymentMeans']?.['ram:TypeCode'] || settlement.SpecifiedTradeSettlementPaymentMeans?.TypeCode);
    
    const lineItems = supplyChainTrade['ram:IncludedSupplyChainTradeLineItem'] || supplyChainTrade.IncludedSupplyChainTradeLineItem;
    if (lineItems) invoice.lineItems = parseArray(lineItems).map(item => parseCIILineItem(item));

    const taxBreakdown = settlement['ram:ApplicableTradeTax'] || settlement.ApplicableTradeTax;
    if (taxBreakdown) invoice.taxes = parseArray(taxBreakdown).map(tax => parseCIITax(tax));

    const summation = settlement['ram:SpecifiedTradeSettlementHeaderMonetarySummation'] || settlement.SpecifiedTradeSettlementHeaderMonetarySummation;
    if (summation) invoice.monetarySummation = parseMonetarySummation(summation);
  }

  return invoice;
}

function parseUBLStructure(ubl: Record<string, unknown>, errors: string[], warnings: string[]): ZUGFeRDInvoice {
  const metadata: ZUGFeRDMetaData = { xmlVersion: extractVersion(ubl, 'ubl'), profile: extractUBLCustomizationId(ubl), flavor: 'EXTENDED' };
  const invoice: ZUGFeRDInvoice = { metadata, lineItems: [], taxes: [], monetarySummation: {} };

  invoice.documentId = getTextContent(ubl['cbc:ID'] || ubl.ID);
  invoice.documentType = getTextContent(ubl['cbc:InvoiceTypeCode'] || ubl.InvoiceTypeCode);
  invoice.documentDate = getTextContent(ubl['cbc:IssueDate'] || ubl.IssueDate);
  invoice.notes = extractUBLNotes(ubl['cbc:Note'] || ubl.Note);
  invoice.currency = getTextContent(ubl['cbc:DocumentCurrencyCode'] || ubl.DocumentCurrencyCode);
  invoice.dueDate = getTextContent(ubl['cbc:DueDate'] || ubl.DueDate);

  const orderRef = ubl['cac:OrderReference'] || ubl.OrderReference;
  invoice.orderReference = getTextContent(orderRef?.['cbc:ID'] || orderRef?.ID);

  const accountingSupplier = ubl['cac:AccountingSupplierParty'] || ubl.AccountingSupplierParty;
  const accountingCustomer = ubl['cac:AccountingCustomerParty'] || ubl.AccountingCustomerParty;
  
  if (accountingSupplier) invoice.seller = parseUBLParty(accountingSupplier['cac:Party'] || accountingSupplier.Party);
  if (accountingCustomer) invoice.buyer = parseUBLParty(accountingCustomer['cac:Party'] || accountingCustomer.Party);

  const delivery = ubl['cac:Delivery'] || ubl.Delivery;
  if (delivery) invoice.deliveryDate = getTextContent(delivery['cbc:ActualDeliveryDate'] || delivery.ActualDeliveryDate);

  const paymentMeans = ubl['cac:PaymentMeans'] || ubl.PaymentMeans;
  if (paymentMeans) {
    const pm = parseArray(paymentMeans)[0];
    if (pm) {
      invoice.paymentMeansCode = getTextContent(pm['cbc:PaymentMeansCode'] || pm.PaymentMeansCode);
      invoice.payeeIban = getTextContent(pm['cac:PayeeFinancialAccount']?.['cbc:ID'] || pm.PayeeFinancialAccount?.ID);
    }
  }

  const lineItems = ubl['cac:InvoiceLine'] || ubl.InvoiceLine;
  if (lineItems) invoice.lineItems = parseArray(lineItems).map(item => parseUBLLineItem(item));

  const taxTotal = ubl['cac:TaxTotal'] || ubl.TaxTotal;
  if (taxTotal) {
    const subtotal = taxTotal['cac:TaxSubtotal'] || taxTotal.TaxSubtotal;
    if (subtotal) invoice.taxes = parseArray(subtotal).map(tax => parseUBLTax(tax));
    invoice.monetarySummation.taxTotalAmount = getTextContent(taxTotal['cbc:TaxAmount'] || taxTotal.TaxAmount);
  }

  const legalTotal = ubl['cac:LegalMonetaryTotal'] || ubl.LegalMonetaryTotal;
  if (legalTotal) {
    invoice.monetarySummation = {
      ...invoice.monetarySummation,
      lineTotalAmount: getTextContent(legalTotal['cbc:LineExtensionAmount'] || legalTotal.LineExtensionAmount),
      taxBasisTotalAmount: getTextContent(legalTotal['cbc:TaxExclusiveAmount'] || legalTotal.TaxExclusiveAmount),
      grandTotalAmount: getTextContent(legalTotal['cbc:TaxInclusiveAmount'] || legalTotal.TaxInclusiveAmount),
      duePayableAmount: getTextContent(legalTotal['cbc:PayableAmount'] || legalTotal.PayableAmount),
    };
  }

  return invoice;
}

function parseCIIParty(party: Record<string, unknown> | undefined): ZUGFeRDParty | undefined {
  if (!party) return undefined;

  const legalOrg = party['ram:SpecifiedLegalOrganization'] || party.SpecifiedLegalOrganization;
  const tradeAddress = party['ram:PostalTradeAddress'] || party.PostalTradeAddress;
  const taxReg = party['ram:SpecifiedTaxRegistration'] || party.SpecifiedTaxRegistration;
  const contact = party['ram:DefinedTradeContact'] || party.DefinedTradeContact;

  const vatId = parseArray(taxReg).find(t => getTextContent(t['ram:ID']?.['@_schemeID'] || t.ID?.['@_schemeID']) === 'VA')?.['ram:ID']?.['#text'] || 
                parseArray(taxReg).find(t => getTextContent(t.ID?.schemeID) === 'VA')?.ID?.['#text'];

  return {
    id: getTextContent(party['ram:ID'] || party.ID),
    name: getTextContent(party['ram:Name'] || party.Name) || getTextContent(legalOrg?.['ram:TradingBusinessName'] || legalOrg?.TradingBusinessName),
    legalForm: getTextContent(legalOrg?.['ram:LegalForm'] || legalOrg?.LegalForm),
    contactName: getTextContent(contact?.['ram:PersonName'] || contact?.PersonName),
    contactPhone: getTextContent(contact?.['ram:TelephoneUniversalCommunication']?.['ram:CompleteNumber'] || contact?.TelephoneUniversalCommunication?.CompleteNumber),
    contactEmail: getTextContent(contact?.['ram:EmailURIUniversalCommunication']?.['ram:URIID'] || contact?.EmailURIUniversalCommunication?.URIID),
    addressLine1: getTextContent(tradeAddress?.['ram:LineOne'] || tradeAddress?.LineOne),
    addressLine2: getTextContent(tradeAddress?.['ram:LineTwo'] || tradeAddress?.LineTwo),
    addressLine3: getTextContent(tradeAddress?.['ram:LineThree'] || tradeAddress?.LineThree),
    postcode: getTextContent(tradeAddress?.['ram:PostcodeCode'] || tradeAddress?.PostcodeCode),
    city: getTextContent(tradeAddress?.['ram:CityName'] || tradeAddress?.CityName),
    countryCode: getTextContent(tradeAddress?.['ram:CountryID'] || tradeAddress?.CountryID),
    vatId,
  };
}

function parseUBLParty(party: Record<string, unknown> | undefined): ZUGFeRDParty | undefined {
  if (!party) return undefined;

  const legalEntity = party['cac:PartyLegalEntity'] || party.PartyLegalEntity;
  const postalAddress = party['cac:PostalAddress'] || party.PostalAddress;
  const contact = party['cac:Contact'] || party.Contact;
  const partyTaxScheme = party['cac:PartyTaxScheme'] || party.PartyTaxScheme;

  const vatId = getTextContent(parseArray(partyTaxScheme).find(t => getTextContent(t['cac:TaxScheme']?.['cbc:ID'] || t.TaxScheme?.ID) === 'VAT')?.['cbc:CompanyID'] ||
                parseArray(partyTaxScheme).find(t => getTextContent(t.TaxScheme?.ID) === 'VAT')?.CompanyID);

  return {
    name: getTextContent(party['cbc:Name'] || party.Name) || getTextContent(legalEntity?.['cbc:RegistrationName'] || legalEntity?.RegistrationName),
    contactName: getTextContent(contact?.['cbc:Name'] || contact?.Name),
    contactPhone: getTextContent(contact?.['cbc:Telephone'] || contact?.Telephone),
    contactEmail: getTextContent(contact?.['cbc:ElectronicMail'] || contact?.ElectronicMail),
    addressLine1: getTextContent(postalAddress?.['cbc:StreetName'] || postalAddress?.StreetName),
    addressLine2: getTextContent(postalAddress?.['cbc:AdditionalStreetName'] || postalAddress?.AdditionalStreetName),
    postcode: getTextContent(postalAddress?.['cbc:PostalZone'] || postalAddress?.PostalZone),
    city: getTextContent(postalAddress?.['cbc:CityName'] || postalAddress?.CityName),
    countryCode: getTextContent(postalAddress?.['cac:Country']?.['cbc:IdentificationCode'] || postalAddress?.Country?.IdentificationCode),
    vatId,
  };
}

function parseCIILineItem(item: Record<string, unknown>): ZUGFeRDTradeLineItem {
  const agreement = item['ram:SpecifiedLineTradeAgreement'] || item.SpecifiedLineTradeAgreement;
  const delivery = item['ram:SpecifiedLineTradeDelivery'] || item.SpecifiedLineTradeDelivery;
  const settlement = item['ram:SpecifiedLineTradeSettlement'] || item.SpecifiedLineTradeSettlement;
  const product = item['ram:SpecifiedTradeProduct'] || item.SpecifiedTradeProduct;
  const netPrice = agreement?.['ram:NetPriceProductTradePrice'] || agreement?.NetPriceProductTradePrice;
  const tradeTax = settlement?.['ram:ApplicableTradeTax'] || settlement?.ApplicableTradeTax;

  return {
    id: getTextContent(item['ram:AssociatedDocumentLineDocument']?.['ram:LineID'] || item.AssociatedDocumentLineDocument?.LineID),
    name: getTextContent(product?.['ram:Name'] || product?.Name),
    description: getTextContent(product?.['ram:Description'] || product?.Description),
    unitCode: getTextContent(delivery?.['ram:BilledQuantity']?.['@_unitCode'] || delivery?.BilledQuantity?.['@_unitCode']),
    unitPrice: getTextContent(netPrice?.['ram:ChargeAmount'] || netPrice?.ChargeAmount),
    billedQuantity: getTextContent(delivery?.['ram:BilledQuantity']?.['#text'] || delivery?.BilledQuantity?.['#text']),
    lineTotalAmount: getTextContent(settlement?.['ram:SpecifiedTradeSettlementLineMonetarySummation']?.['ram:LineTotalAmount'] || settlement?.SpecifiedTradeSettlementLineMonetarySummation?.LineTotalAmount),
    taxRatePercent: getTextContent(tradeTax?.['ram:RateApplicablePercent'] || tradeTax?.RateApplicablePercent),
    taxCategoryCode: getTextContent(tradeTax?.['ram:CategoryCode'] || tradeTax?.CategoryCode),
  };
}

function parseUBLLineItem(item: Record<string, unknown>): ZUGFeRDTradeLineItem {
  const price = item['cac:Price'] || item.Price;
  const itemData = item['cac:Item'] || item.Item;
  const tax = itemData?.['cac:ClassifiedTaxCategory'] || itemData?.ClassifiedTaxCategory;

  return {
    id: getTextContent(item['cbc:ID'] || item.ID),
    name: getTextContent(itemData?.['cbc:Name'] || itemData?.Name),
    description: getTextContent(itemData?.['cbc:Description'] || itemData?.Description),
    unitCode: getTextContent(item['cbc:InvoicedQuantity']?.['@_unitCode'] || item.InvoicedQuantity?.['@_unitCode']),
    unitPrice: getTextContent(price?.['cbc:PriceAmount'] || price?.PriceAmount),
    billedQuantity: getTextContent(item['cbc:InvoicedQuantity']?.['#text'] || item.InvoicedQuantity?.['#text']),
    lineTotalAmount: getTextContent(item['cbc:LineExtensionAmount'] || item.LineExtensionAmount),
    taxRatePercent: getTextContent(tax?.['cbc:Percent'] || tax?.Percent),
    taxCategoryCode: getTextContent(tax?.['cbc:ID'] || tax?.ID),
  };
}

function parseCIITax(tax: Record<string, unknown>): ZUGFeRDTax {
  return {
    typeCode: getTextContent(tax['ram:TypeCode'] || tax.TypeCode),
    categoryCode: getTextContent(tax['ram:CategoryCode'] || tax.CategoryCode),
    ratePercent: getTextContent(tax['ram:RateApplicablePercent'] || tax.RateApplicablePercent),
    basisAmount: getTextContent(tax['ram:BasisAmount'] || tax.BasisAmount),
    calculatedAmount: getTextContent(tax['ram:CalculatedAmount'] || tax.CalculatedAmount),
  };
}

function parseUBLTax(tax: Record<string, unknown>): ZUGFeRDTax {
  const taxCategory = tax['cac:TaxCategory'] || tax.TaxCategory;
  return {
    typeCode: getTextContent(taxCategory?.['cac:TaxScheme']?.['cbc:ID'] || taxCategory?.TaxScheme?.ID),
    categoryCode: getTextContent(taxCategory?.['cbc:ID'] || taxCategory?.ID),
    ratePercent: getTextContent(taxCategory?.['cbc:Percent'] || taxCategory?.Percent),
    basisAmount: getTextContent(tax['cbc:TaxableAmount'] || tax.TaxableAmount),
    calculatedAmount: getTextContent(tax['cbc:TaxAmount'] || tax.TaxAmount),
  };
}

function parsePaymentTerms(settlement: Record<string, unknown>): ZUGFeRDPaymentTerms | undefined {
  const terms = settlement['ram:SpecifiedTradePaymentTerms'] || settlement.SpecifiedTradePaymentTerms;
  if (!terms) return undefined;
  return {
    description: getTextContent(terms['ram:Description'] || terms.Description),
    dueDate: getDateContent(terms['ram:DueDateDateTime'] || terms.DueDateDateTime),
    directDebitMandateId: getTextContent(terms['ram:DirectDebitMandateID'] || terms.DirectDebitMandateID),
  };
}

function parseMonetarySummation(summation: Record<string, unknown>): ZUGFeRDMonetarySummation {
  return {
    lineTotalAmount: getTextContent(summation['ram:LineTotalAmount'] || summation.LineTotalAmount),
    chargeTotalAmount: getTextContent(summation['ram:ChargeTotalAmount'] || summation.ChargeTotalAmount),
    allowanceTotalAmount: getTextContent(summation['ram:AllowanceTotalAmount'] || summation.AllowanceTotalAmount),
    taxBasisTotalAmount: getTextContent(summation['ram:TaxBasisTotalAmount'] || summation.TaxBasisTotalAmount),
    taxTotalAmount: getTextContent(summation['ram:TaxTotalAmount'] || summation.TaxTotalAmount),
    grandTotalAmount: getTextContent(summation['ram:GrandTotalAmount'] || summation.GrandTotalAmount),
    totalPrepaidAmount: getTextContent(summation['ram:TotalPrepaidAmount'] || summation.TotalPrepaidAmount),
    duePayableAmount: getTextContent(summation['ram:DuePayableAmount'] || summation.DuePayableAmount),
  };
}

function extractVersion(parsed: Record<string, unknown>, format: 'cii' | 'ubl'): string | undefined {
  if (format === 'cii') {
    const context = parsed['rsm:ExchangedDocumentContext'] || parsed.ExchangedDocumentContext;
    const guid = context?.['ram:GuidelineSpecifiedDocumentContextParameter']?.['ram:ID'] || context?.GuidelineSpecifiedDocumentContextParameter?.ID;
    const version = getTextContent(guid);
    const match = version?.match(/ver(\d+p\d+)/);
    return match ? match[1].replace('p', '.') : version;
  }
  return getTextContent(parsed['cbc:VersionID'] || parsed.VersionID);
}

function extractProfile(parsed: Record<string, unknown>, format: 'cii' | 'ubl'): string | undefined {
  if (format === 'cii') {
    const context = parsed['rsm:ExchangedDocumentContext'] || parsed.ExchangedDocumentContext;
    const guid = context?.['ram:GuidelineSpecifiedDocumentContextParameter']?.['ram:ID'] || context?.GuidelineSpecifiedDocumentContextParameter?.ID;
    const profile = getTextContent(guid);
    const match = profile?.match(/:(\w+):/);
    return match ? match[1] : profile;
  }
  return undefined;
}

function extractUBLCustomizationId(parsed: Record<string, unknown>): string | undefined {
  return getTextContent(parsed['cbc:CustomizationID'] || parsed.CustomizationID);
}

function extractNotes(notes: unknown): string[] {
  if (!notes) return [];
  return parseArray(notes).map(note => getTextContent(note['ram:Content'] || note.Content)).filter(Boolean) as string[];
}

function extractUBLNotes(notes: unknown): string[] {
  if (!notes) return [];
  return parseArray(notes).map(note => typeof note === 'string' ? note : getTextContent(note)).filter(Boolean) as string[];
}

function getTextContent(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return value['#text'] || value.text || String(value);
  return undefined;
}

function getDateContent(value: unknown): string | undefined {
  if (!value) return undefined;
  const dateString = typeof value === 'object' ? (value['#text'] || value['udt:DateTimeString']?.['#text']) : value;
  return getTextContent(dateString);
}

function parseArray<T>(value: T | T[]): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}
