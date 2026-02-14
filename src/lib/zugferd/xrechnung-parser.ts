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
} from './types';

export class XRechnungParserError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
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

export function detectInvoiceFlavor(
  xmlContent: string
): InvoiceDetectionResult {
  const parser = new XMLParser({ ...xmlParserOptions, stopNodes: ['*'] });

  try {
    const parsed = parser.parse(xmlContent);

    if (parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice) {
      return {
        flavor: 'ZUGFeRD',
        version: extractVersion(parsed, 'cii'),
        profile: extractProfile(parsed, 'cii'),
      };
    }

    if (parsed['ubl:Invoice'] || parsed.Invoice) {
      const customizationId = extractUBLCustomizationId(parsed);
      if (customizationId?.toLowerCase().includes('xrechnung')) {
        return {
          flavor: 'XRechnung',
          version: extractVersion(parsed, 'ubl'),
          profile: customizationId,
        };
      }
      return {
        flavor: 'ZUGFeRD',
        version: extractVersion(parsed, 'ubl'),
        profile: customizationId,
      };
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

    const cii =
      parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice;

    if (!cii) {
      return {
        success: false,
        errors: ['Invalid CII format: Root element not found'],
        warnings,
      };
    }

    const supplyChainTrade =
      cii['rsm:SupplyChainTradeTransaction'] || cii.SupplyChainTradeTransaction;

    if (!supplyChainTrade) {
      return {
        success: false,
        errors: ['Invalid CII format: SupplyChainTradeTransaction not found'],
        warnings,
      };
    }

    const invoice = parseCIIStructure(cii, supplyChainTrade, errors, warnings);
    return { success: errors.length === 0, invoice, errors, warnings };
  } catch (error) {
    return {
      success: false,
      errors: [
        `Failed to parse CII XML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      warnings,
    };
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
      return {
        success: false,
        errors: ['Invalid UBL format: Root element not found'],
        warnings,
      };
    }

    const parsedInvoice = parseUBLStructure(invoice, errors, warnings);
    return {
      success: errors.length === 0,
      invoice: parsedInvoice,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        `Failed to parse UBL XML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      warnings,
    };
  }
}

function parseCIIStructure(
  cii: Record<string, unknown>,
  supplyChainTrade: Record<string, unknown>,
  _errors: string[],
  _warnings: string[]
): ZUGFeRDInvoice {
  const header = asRecord(
    cii['rsm:ExchangedDocument'] || cii.ExchangedDocument
  );
  const agreement = asRecord(
    supplyChainTrade['ram:ApplicableHeaderTradeAgreement'] ||
      supplyChainTrade.ApplicableHeaderTradeAgreement
  );
  const delivery = asRecord(
    supplyChainTrade['ram:ApplicableHeaderTradeDelivery'] ||
      supplyChainTrade.ApplicableHeaderTradeDelivery
  );
  const settlement = asRecord(
    supplyChainTrade['ram:ApplicableHeaderTradeSettlement'] ||
      supplyChainTrade.ApplicableHeaderTradeSettlement
  );

  const metadata: ZUGFeRDMetaData = {
    xmlVersion: extractVersion(cii, 'cii'),
    profile: extractProfile(cii, 'cii'),
    flavor: 'EXTENDED',
  };
  const invoice: ZUGFeRDInvoice = {
    metadata,
    lineItems: [],
    taxes: [],
    monetarySummation: {},
  };

  if (header) {
    invoice.documentId = getTextContent(header['ram:ID'] || header.ID);
    invoice.documentType = getTextContent(
      header['ram:TypeCode'] || header.TypeCode
    );
    invoice.documentDate = getDateContent(
      header['ram:IssueDateTime'] || header.IssueDateTime
    );
    invoice.notes = extractNotes(
      header['ram:IncludedNote'] || header.IncludedNote
    );
  }

  if (agreement) {
    invoice.seller = parseCIIParty(
      asRecord(agreement['ram:SellerTradeParty'] || agreement.SellerTradeParty)
    );
    invoice.buyer = parseCIIParty(
      asRecord(agreement['ram:BuyerTradeParty'] || agreement.BuyerTradeParty)
    );
    const buyerOrderRef = asRecord(
      agreement['ram:BuyerOrderReferencedDocument'] ||
        agreement.BuyerOrderReferencedDocument
    );
    const contractRef = asRecord(
      agreement['ram:ContractReferencedDocument'] ||
        agreement.ContractReferencedDocument
    );
    invoice.orderReference = getTextContent(
      buyerOrderRef?.['ram:IssuerAssignedID'] || buyerOrderRef?.IssuerAssignedID
    );
    invoice.contractReference = getTextContent(
      contractRef?.['ram:IssuerAssignedID'] || contractRef?.IssuerAssignedID
    );
  }

  if (delivery) {
    const deliveryEvent = asRecord(
      delivery['ram:ActualDeliverySupplyChainEvent'] ||
        delivery.ActualDeliverySupplyChainEvent
    );
    invoice.deliveryDate = getDateContent(
      deliveryEvent?.['ram:OccurrenceDateTime'] ||
        deliveryEvent?.OccurrenceDateTime
    );
  }

  if (settlement) {
    invoice.currency = getTextContent(
      settlement['ram:InvoiceCurrencyCode'] || settlement.InvoiceCurrencyCode
    );
    invoice.paymentTerms = parsePaymentTerms(
      settlement as Record<string, unknown>
    );
    const paymentMeans = asRecord(
      settlement['ram:SpecifiedTradeSettlementPaymentMeans'] ||
        settlement.SpecifiedTradeSettlementPaymentMeans
    );
    invoice.paymentMeansCode = getTextContent(
      paymentMeans?.['ram:TypeCode'] || paymentMeans?.TypeCode
    );

    const lineItems =
      supplyChainTrade['ram:IncludedSupplyChainTradeLineItem'] ||
      supplyChainTrade.IncludedSupplyChainTradeLineItem;
    if (lineItems)
      invoice.lineItems = parseArray(lineItems).map((item) =>
        parseCIILineItem(item as Record<string, unknown>)
      );

    const taxBreakdown =
      settlement['ram:ApplicableTradeTax'] || settlement.ApplicableTradeTax;
    if (taxBreakdown)
      invoice.taxes = parseArray(taxBreakdown).map((tax) =>
        parseCIITax(tax as Record<string, unknown>)
      );

    const summation = asRecord(
      settlement['ram:SpecifiedTradeSettlementHeaderMonetarySummation'] ||
        settlement.SpecifiedTradeSettlementHeaderMonetarySummation
    );
    if (summation)
      invoice.monetarySummation = parseMonetarySummation(
        summation as Record<string, unknown>
      );
  }

  return invoice;
}

function parseUBLStructure(
  ubl: Record<string, unknown>,
  _errors: string[],
  _warnings: string[]
): ZUGFeRDInvoice {
  const metadata: ZUGFeRDMetaData = {
    xmlVersion: extractVersion(ubl, 'ubl'),
    profile: extractUBLCustomizationId(ubl),
    flavor: 'EXTENDED',
  };
  const invoice: ZUGFeRDInvoice = {
    metadata,
    lineItems: [],
    taxes: [],
    monetarySummation: {},
  };

  invoice.documentId = getTextContent(ubl['cbc:ID'] || ubl.ID);
  invoice.documentType = getTextContent(
    ubl['cbc:InvoiceTypeCode'] || ubl.InvoiceTypeCode
  );
  invoice.documentDate = getTextContent(ubl['cbc:IssueDate'] || ubl.IssueDate);
  invoice.notes = extractUBLNotes(ubl['cbc:Note'] || ubl.Note);
  invoice.currency = getTextContent(
    ubl['cbc:DocumentCurrencyCode'] || ubl.DocumentCurrencyCode
  );
  invoice.dueDate = getTextContent(ubl['cbc:DueDate'] || ubl.DueDate);

  const orderRef = asRecord(ubl['cac:OrderReference'] || ubl.OrderReference);
  invoice.orderReference = getTextContent(orderRef?.['cbc:ID'] || orderRef?.ID);

  const accountingSupplier = asRecord(
    ubl['cac:AccountingSupplierParty'] || ubl.AccountingSupplierParty
  );
  const accountingCustomer = asRecord(
    ubl['cac:AccountingCustomerParty'] || ubl.AccountingCustomerParty
  );

  if (accountingSupplier)
    invoice.seller = parseUBLParty(
      asRecord(accountingSupplier['cac:Party'] || accountingSupplier.Party)
    );
  if (accountingCustomer)
    invoice.buyer = parseUBLParty(
      asRecord(accountingCustomer['cac:Party'] || accountingCustomer.Party)
    );

  const delivery = asRecord(ubl['cac:Delivery'] || ubl.Delivery);
  if (delivery)
    invoice.deliveryDate = getTextContent(
      delivery['cbc:ActualDeliveryDate'] || delivery.ActualDeliveryDate
    );

  const paymentMeans = ubl['cac:PaymentMeans'] || ubl.PaymentMeans;
  if (paymentMeans) {
    const pm = asRecord(parseArray(paymentMeans)[0]);
    if (pm) {
      invoice.paymentMeansCode = getTextContent(
        pm['cbc:PaymentMeansCode'] || pm.PaymentMeansCode
      );
      const payeeAccount = asRecord(
        pm['cac:PayeeFinancialAccount'] || pm.PayeeFinancialAccount
      );
      invoice.payeeIban = getTextContent(
        payeeAccount?.['cbc:ID'] || payeeAccount?.ID
      );
    }
  }

  const lineItems = ubl['cac:InvoiceLine'] || ubl.InvoiceLine;
  if (lineItems)
    invoice.lineItems = parseArray(lineItems).map((item) =>
      parseUBLLineItem(item as Record<string, unknown>)
    );

  const taxTotal = asRecord(ubl['cac:TaxTotal'] || ubl.TaxTotal);
  if (taxTotal) {
    const subtotal = taxTotal['cac:TaxSubtotal'] || taxTotal.TaxSubtotal;
    if (subtotal)
      invoice.taxes = parseArray(subtotal).map((tax) =>
        parseUBLTax(tax as Record<string, unknown>)
      );
    invoice.monetarySummation.taxTotalAmount = getTextContent(
      taxTotal['cbc:TaxAmount'] || taxTotal.TaxAmount
    );
  }

  const legalTotal = asRecord(
    ubl['cac:LegalMonetaryTotal'] || ubl.LegalMonetaryTotal
  );
  if (legalTotal) {
    invoice.monetarySummation = {
      ...invoice.monetarySummation,
      lineTotalAmount: getTextContent(
        legalTotal['cbc:LineExtensionAmount'] || legalTotal.LineExtensionAmount
      ),
      taxBasisTotalAmount: getTextContent(
        legalTotal['cbc:TaxExclusiveAmount'] || legalTotal.TaxExclusiveAmount
      ),
      grandTotalAmount: getTextContent(
        legalTotal['cbc:TaxInclusiveAmount'] || legalTotal.TaxInclusiveAmount
      ),
      duePayableAmount: getTextContent(
        legalTotal['cbc:PayableAmount'] || legalTotal.PayableAmount
      ),
    };
  }

  return invoice;
}

function parseCIIParty(
  party: Record<string, unknown> | undefined
): ZUGFeRDParty | undefined {
  if (!party) return undefined;

  const legalOrg = asRecord(
    party['ram:SpecifiedLegalOrganization'] || party.SpecifiedLegalOrganization
  );
  const tradeAddress = asRecord(
    party['ram:PostalTradeAddress'] || party.PostalTradeAddress
  );
  const taxReg =
    party['ram:SpecifiedTaxRegistration'] || party.SpecifiedTaxRegistration;
  const contact = asRecord(
    party['ram:DefinedTradeContact'] || party.DefinedTradeContact
  );

  const vatId = (() => {
    const regs = parseArray(taxReg);
    for (const t of regs) {
      const rec = asRecord(t);
      const id = asRecord(rec?.['ram:ID'] || rec?.ID);
      if (getTextContent(id?.['@_schemeID'] || id?.schemeID) === 'VA') {
        return getTextContent(id?.['#text'] || id);
      }
    }
    return undefined;
  })();

  const phone = asRecord(
    contact?.['ram:TelephoneUniversalCommunication'] ||
      contact?.TelephoneUniversalCommunication
  );
  const email = asRecord(
    contact?.['ram:EmailURIUniversalCommunication'] ||
      contact?.EmailURIUniversalCommunication
  );

  return {
    id: getTextContent(party['ram:ID'] || party.ID),
    name:
      getTextContent(party['ram:Name'] || party.Name) ||
      getTextContent(
        legalOrg?.['ram:TradingBusinessName'] || legalOrg?.TradingBusinessName
      ),
    legalForm: getTextContent(
      legalOrg?.['ram:LegalForm'] || legalOrg?.LegalForm
    ),
    contactName: getTextContent(
      contact?.['ram:PersonName'] || contact?.PersonName
    ),
    contactPhone: getTextContent(
      phone?.['ram:CompleteNumber'] || phone?.CompleteNumber
    ),
    contactEmail: getTextContent(email?.['ram:URIID'] || email?.URIID),
    addressLine1: getTextContent(
      tradeAddress?.['ram:LineOne'] || tradeAddress?.LineOne
    ),
    addressLine2: getTextContent(
      tradeAddress?.['ram:LineTwo'] || tradeAddress?.LineTwo
    ),
    addressLine3: getTextContent(
      tradeAddress?.['ram:LineThree'] || tradeAddress?.LineThree
    ),
    postcode: getTextContent(
      tradeAddress?.['ram:PostcodeCode'] || tradeAddress?.PostcodeCode
    ),
    city: getTextContent(
      tradeAddress?.['ram:CityName'] || tradeAddress?.CityName
    ),
    countryCode: getTextContent(
      tradeAddress?.['ram:CountryID'] || tradeAddress?.CountryID
    ),
    vatId,
  };
}

function parseUBLParty(
  party: Record<string, unknown> | undefined
): ZUGFeRDParty | undefined {
  if (!party) return undefined;

  const legalEntity = asRecord(
    party['cac:PartyLegalEntity'] || party.PartyLegalEntity
  );
  const postalAddress = asRecord(
    party['cac:PostalAddress'] || party.PostalAddress
  );
  const contact = asRecord(party['cac:Contact'] || party.Contact);
  const partyTaxScheme = party['cac:PartyTaxScheme'] || party.PartyTaxScheme;

  const vatId = (() => {
    const schemes = parseArray(partyTaxScheme);
    for (const t of schemes) {
      const rec = asRecord(t);
      const taxScheme = asRecord(rec?.['cac:TaxScheme'] || rec?.TaxScheme);
      if (getTextContent(taxScheme?.['cbc:ID'] || taxScheme?.ID) === 'VAT') {
        return getTextContent(rec?.['cbc:CompanyID'] || rec?.CompanyID);
      }
    }
    return undefined;
  })();

  const country = asRecord(
    postalAddress?.['cac:Country'] || postalAddress?.Country
  );

  return {
    name:
      getTextContent(party['cbc:Name'] || party.Name) ||
      getTextContent(
        legalEntity?.['cbc:RegistrationName'] || legalEntity?.RegistrationName
      ),
    contactName: getTextContent(contact?.['cbc:Name'] || contact?.Name),
    contactPhone: getTextContent(
      contact?.['cbc:Telephone'] || contact?.Telephone
    ),
    contactEmail: getTextContent(
      contact?.['cbc:ElectronicMail'] || contact?.ElectronicMail
    ),
    addressLine1: getTextContent(
      postalAddress?.['cbc:StreetName'] || postalAddress?.StreetName
    ),
    addressLine2: getTextContent(
      postalAddress?.['cbc:AdditionalStreetName'] ||
        postalAddress?.AdditionalStreetName
    ),
    postcode: getTextContent(
      postalAddress?.['cbc:PostalZone'] || postalAddress?.PostalZone
    ),
    city: getTextContent(
      postalAddress?.['cbc:CityName'] || postalAddress?.CityName
    ),
    countryCode: getTextContent(
      country?.['cbc:IdentificationCode'] || country?.IdentificationCode
    ),
    vatId,
  };
}

function parseCIILineItem(item: Record<string, unknown>): ZUGFeRDTradeLineItem {
  const agreement = asRecord(
    item['ram:SpecifiedLineTradeAgreement'] || item.SpecifiedLineTradeAgreement
  );
  const delivery = asRecord(
    item['ram:SpecifiedLineTradeDelivery'] || item.SpecifiedLineTradeDelivery
  );
  const settlement = asRecord(
    item['ram:SpecifiedLineTradeSettlement'] ||
      item.SpecifiedLineTradeSettlement
  );
  const product = asRecord(
    item['ram:SpecifiedTradeProduct'] || item.SpecifiedTradeProduct
  );
  const netPrice = asRecord(
    agreement?.['ram:NetPriceProductTradePrice'] ||
      agreement?.NetPriceProductTradePrice
  );
  const tradeTax = asRecord(
    settlement?.['ram:ApplicableTradeTax'] || settlement?.ApplicableTradeTax
  );
  const docLine = asRecord(
    item['ram:AssociatedDocumentLineDocument'] ||
      item.AssociatedDocumentLineDocument
  );
  const billedQty = asRecord(
    delivery?.['ram:BilledQuantity'] || delivery?.BilledQuantity
  );
  const summation = asRecord(
    settlement?.['ram:SpecifiedTradeSettlementLineMonetarySummation'] ||
      settlement?.SpecifiedTradeSettlementLineMonetarySummation
  );

  return {
    id: getTextContent(docLine?.['ram:LineID'] || docLine?.LineID),
    name: getTextContent(product?.['ram:Name'] || product?.Name),
    description: getTextContent(
      product?.['ram:Description'] || product?.Description
    ),
    unitCode: getTextContent(billedQty?.['@_unitCode']),
    unitPrice: getTextContent(
      netPrice?.['ram:ChargeAmount'] || netPrice?.ChargeAmount
    ),
    billedQuantity: getTextContent(billedQty?.['#text']),
    lineTotalAmount: getTextContent(
      summation?.['ram:LineTotalAmount'] || summation?.LineTotalAmount
    ),
    taxRatePercent: getTextContent(
      tradeTax?.['ram:RateApplicablePercent'] || tradeTax?.RateApplicablePercent
    ),
    taxCategoryCode: getTextContent(
      tradeTax?.['ram:CategoryCode'] || tradeTax?.CategoryCode
    ),
  };
}

function parseUBLLineItem(item: Record<string, unknown>): ZUGFeRDTradeLineItem {
  const price = asRecord(item['cac:Price'] || item.Price);
  const itemData = asRecord(item['cac:Item'] || item.Item);
  const tax = asRecord(
    itemData?.['cac:ClassifiedTaxCategory'] || itemData?.ClassifiedTaxCategory
  );
  const invoicedQty = asRecord(
    item['cbc:InvoicedQuantity'] || item.InvoicedQuantity
  );

  return {
    id: getTextContent(item['cbc:ID'] || item.ID),
    name: getTextContent(itemData?.['cbc:Name'] || itemData?.Name),
    description: getTextContent(
      itemData?.['cbc:Description'] || itemData?.Description
    ),
    unitCode: getTextContent(invoicedQty?.['@_unitCode']),
    unitPrice: getTextContent(price?.['cbc:PriceAmount'] || price?.PriceAmount),
    billedQuantity: getTextContent(invoicedQty?.['#text']),
    lineTotalAmount: getTextContent(
      item['cbc:LineExtensionAmount'] || item.LineExtensionAmount
    ),
    taxRatePercent: getTextContent(tax?.['cbc:Percent'] || tax?.Percent),
    taxCategoryCode: getTextContent(tax?.['cbc:ID'] || tax?.ID),
  };
}

function parseCIITax(tax: Record<string, unknown>): ZUGFeRDTax {
  return {
    typeCode: getTextContent(tax['ram:TypeCode'] || tax.TypeCode),
    categoryCode: getTextContent(tax['ram:CategoryCode'] || tax.CategoryCode),
    ratePercent: getTextContent(
      tax['ram:RateApplicablePercent'] || tax.RateApplicablePercent
    ),
    basisAmount: getTextContent(tax['ram:BasisAmount'] || tax.BasisAmount),
    calculatedAmount: getTextContent(
      tax['ram:CalculatedAmount'] || tax.CalculatedAmount
    ),
  };
}

function parseUBLTax(tax: Record<string, unknown>): ZUGFeRDTax {
  const taxCategory = asRecord(tax['cac:TaxCategory'] || tax.TaxCategory);
  const taxScheme = asRecord(
    taxCategory?.['cac:TaxScheme'] || taxCategory?.TaxScheme
  );
  return {
    typeCode: getTextContent(taxScheme?.['cbc:ID'] || taxScheme?.ID),
    categoryCode: getTextContent(taxCategory?.['cbc:ID'] || taxCategory?.ID),
    ratePercent: getTextContent(
      taxCategory?.['cbc:Percent'] || taxCategory?.Percent
    ),
    basisAmount: getTextContent(tax['cbc:TaxableAmount'] || tax.TaxableAmount),
    calculatedAmount: getTextContent(tax['cbc:TaxAmount'] || tax.TaxAmount),
  };
}

function parsePaymentTerms(
  settlement: Record<string, unknown>
): ZUGFeRDPaymentTerms | undefined {
  const terms = asRecord(
    settlement['ram:SpecifiedTradePaymentTerms'] ||
      settlement.SpecifiedTradePaymentTerms
  );
  if (!terms) return undefined;
  return {
    description: getTextContent(terms['ram:Description'] || terms.Description),
    dueDate: getDateContent(
      terms['ram:DueDateDateTime'] || terms.DueDateDateTime
    ),
    directDebitMandateId: getTextContent(
      terms['ram:DirectDebitMandateID'] || terms.DirectDebitMandateID
    ),
  };
}

function parseMonetarySummation(
  summation: Record<string, unknown>
): ZUGFeRDMonetarySummation {
  return {
    lineTotalAmount: getTextContent(
      summation['ram:LineTotalAmount'] || summation.LineTotalAmount
    ),
    chargeTotalAmount: getTextContent(
      summation['ram:ChargeTotalAmount'] || summation.ChargeTotalAmount
    ),
    allowanceTotalAmount: getTextContent(
      summation['ram:AllowanceTotalAmount'] || summation.AllowanceTotalAmount
    ),
    taxBasisTotalAmount: getTextContent(
      summation['ram:TaxBasisTotalAmount'] || summation.TaxBasisTotalAmount
    ),
    taxTotalAmount: getTextContent(
      summation['ram:TaxTotalAmount'] || summation.TaxTotalAmount
    ),
    grandTotalAmount: getTextContent(
      summation['ram:GrandTotalAmount'] || summation.GrandTotalAmount
    ),
    totalPrepaidAmount: getTextContent(
      summation['ram:TotalPrepaidAmount'] || summation.TotalPrepaidAmount
    ),
    duePayableAmount: getTextContent(
      summation['ram:DuePayableAmount'] || summation.DuePayableAmount
    ),
  };
}

function extractVersion(
  parsed: Record<string, unknown>,
  format: 'cii' | 'ubl'
): string | undefined {
  if (format === 'cii') {
    const cii =
      asRecord(
        parsed['rsm:CrossIndustryInvoice'] ?? parsed.CrossIndustryInvoice
      ) ?? parsed;
    const context = asRecord(
      cii['rsm:ExchangedDocumentContext'] || cii.ExchangedDocumentContext
    );
    const guidParam = asRecord(
      context?.['ram:GuidelineSpecifiedDocumentContextParameter'] ||
        context?.GuidelineSpecifiedDocumentContextParameter
    );
    const guid = guidParam?.['ram:ID'] || guidParam?.ID;
    const version = getTextContent(guid);
    const match = version?.match(/ver(\d+p\d+)/);
    return match ? match[1].replace('p', '.') : version;
  }
  return getTextContent(parsed['cbc:VersionID'] || parsed.VersionID);
}

function extractProfile(
  parsed: Record<string, unknown>,
  format: 'cii' | 'ubl'
): string | undefined {
  if (format === 'cii') {
    const cii =
      asRecord(
        parsed['rsm:CrossIndustryInvoice'] ?? parsed.CrossIndustryInvoice
      ) ?? parsed;
    const context = asRecord(
      cii['rsm:ExchangedDocumentContext'] || cii.ExchangedDocumentContext
    );
    const guidParam = asRecord(
      context?.['ram:GuidelineSpecifiedDocumentContextParameter'] ||
        context?.GuidelineSpecifiedDocumentContextParameter
    );
    const guid = guidParam?.['ram:ID'] || guidParam?.ID;
    const profile = getTextContent(guid);
    const match = profile?.match(/:(\w+):/);
    return match ? match[1] : profile;
  }
  return undefined;
}

function extractUBLCustomizationId(
  parsed: Record<string, unknown>
): string | undefined {
  return getTextContent(
    parsed['cbc:CustomizationID'] || parsed.CustomizationID
  );
}

function extractNotes(notes: unknown): string[] {
  if (!notes) return [];
  return parseArray(notes)
    .map((note) => {
      const rec = asRecord(note);
      return getTextContent(rec?.['ram:Content'] || rec?.Content);
    })
    .filter(Boolean) as string[];
}

function extractUBLNotes(notes: unknown): string[] {
  if (!notes) return [];
  return parseArray(notes)
    .map((note) => (typeof note === 'string' ? note : getTextContent(note)))
    .filter(Boolean) as string[];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object')
    return value as Record<string, unknown>;
  return undefined;
}

function getTextContent(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return (rec['#text'] as string) || (rec.text as string) || String(value);
  }
  return undefined;
}

function getDateContent(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const dateTimeString = asRecord(rec['udt:DateTimeString']);
    const dateString =
      (rec['#text'] as string) || (dateTimeString?.['#text'] as string);
    return getTextContent(dateString);
  }
  return getTextContent(value);
}

function parseArray<T>(value: T | T[]): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}
