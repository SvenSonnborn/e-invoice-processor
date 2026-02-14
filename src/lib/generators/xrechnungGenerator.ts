import {
  InvoiceService,
  type Invoice as EInvoiceData,
} from '@e-invoice-eu/core';
import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { XMLParser } from 'fast-xml-parser';
import type {
  Invoice as DbInvoice,
  InvoiceLineItem as DbInvoiceLineItem,
} from '@/src/generated/prisma/client';

const execFileAsync = promisify(execFile);

const DEFAULT_FORMAT = 'XRECHNUNG-CII';
const DEFAULT_LANG = 'de';
const DEFAULT_UNIT_CODE = 'C62';
const DEFAULT_COUNTRY_CODE = 'DE';
const DEFAULT_XSD_FILE = 'Factur-X_1.07.3_EN16931.xsd';
const DEFAULT_XSD_PATH = path.resolve(
  process.cwd(),
  'src/lib/generators/schemas/xrechnung',
  DEFAULT_XSD_FILE
);

interface InvoiceRawJsonAddress {
  line1?: string;
  postcode?: string;
  city?: string;
  countryCode?: string;
}

interface InvoiceRawJsonParty {
  address?: InvoiceRawJsonAddress;
}

interface InvoiceRawJsonLineItem {
  name?: string;
  description?: string;
  quantity?: string;
  unitPrice?: string;
  totalAmount?: string;
}

interface InvoiceRawJsonExtendedData {
  supplierDetails?: InvoiceRawJsonParty;
  customerDetails?: InvoiceRawJsonParty;
  lineItems?: InvoiceRawJsonLineItem[];
}

interface InvoiceRawJsonPayload {
  extendedData?: InvoiceRawJsonExtendedData;
}

interface PreparedLineItem {
  positionIndex: number;
  description: string;
  quantity: number;
  unitPrice: number;
  netAmount: number;
  taxRate: number;
  taxAmount: number;
  grossAmount: number;
  taxCategoryCode: 'S' | 'Z';
}

interface TaxSubtotal {
  taxRate: number;
  taxCategoryCode: 'S' | 'Z';
  taxableAmount: number;
  taxAmount: number;
}

export interface XRechnungGeneratorInput extends DbInvoice {
  lineItems?: DbInvoiceLineItem[];
}

export interface XRechnungGeneratorOptions {
  lang?: string;
  validateXsd?: boolean;
  xsdPath?: string;
  xmllintPath?: string;
  xmllintTimeoutMs?: number;
}

export interface XRechnungValidationResult {
  valid: boolean;
  errors: string[];
  schemaPath: string;
}

export interface XRechnungGenerationResult {
  xml: string;
  validation: XRechnungValidationResult;
}

export class XRechnungGeneratorError extends Error {
  public readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'XRechnungGeneratorError';
    this.details = details;
  }
}

const generatorLogger = {
  log: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  error: (..._args: unknown[]) => {},
};

export async function generateXRechnungXML(
  invoice: XRechnungGeneratorInput,
  options: XRechnungGeneratorOptions = {}
): Promise<string> {
  const result = await generateXRechnung(invoice, options);
  return result.xml;
}

export async function generateXRechnung(
  invoice: XRechnungGeneratorInput,
  options: XRechnungGeneratorOptions = {}
): Promise<XRechnungGenerationResult> {
  const payload = mapInvoiceToEInvoiceData(invoice);
  const service = new InvoiceService(generatorLogger);

  const generated = await service.generate(payload, {
    format: DEFAULT_FORMAT,
    lang: options.lang || DEFAULT_LANG,
    noWarnings: true,
  });

  if (typeof generated !== 'string') {
    throw new XRechnungGeneratorError(
      'Expected XML output as string, got binary data instead.'
    );
  }

  const validation =
    options.validateXsd === false
      ? {
          valid: true,
          errors: [],
          schemaPath: resolveSchemaPath(options.xsdPath),
        }
      : await validateXRechnungXML(generated, options);

  if (!validation.valid) {
    throw new XRechnungGeneratorError(
      'Generated XRechnung XML did not pass validation.',
      validation.errors
    );
  }

  return {
    xml: generated,
    validation,
  };
}

export async function validateXRechnungXML(
  xml: string,
  options: Pick<
    XRechnungGeneratorOptions,
    'xsdPath' | 'xmllintPath' | 'xmllintTimeoutMs'
  > = {}
): Promise<XRechnungValidationResult> {
  const schemaPath = resolveSchemaPath(options.xsdPath);
  await ensureSchemaExists(schemaPath);

  const profileErrors = validateXRechnungProfile(xml);
  const tempDir = await mkdtemp(path.join(tmpdir(), 'xrechnung-validation-'));
  const xmlPath = path.join(tempDir, 'invoice.xml');

  try {
    await writeFile(xmlPath, xml, 'utf8');

    await execFileAsync(
      options.xmllintPath || 'xmllint',
      ['--noout', '--schema', schemaPath, xmlPath],
      {
        timeout: options.xmllintTimeoutMs || 15000,
        maxBuffer: 1024 * 1024 * 10,
      }
    );

    return {
      valid: profileErrors.length === 0,
      errors: profileErrors,
      schemaPath,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [...profileErrors, ...extractXmllintErrors(error)],
      schemaPath,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function mapInvoiceToEInvoiceData(
  invoice: XRechnungGeneratorInput
): EInvoiceData {
  const rawJson = getRawJsonPayload(invoice.rawJson);
  const invoiceNumber = normalizeString(invoice.number) || invoice.id;
  const issueDate = toDateOnly(invoice.issueDate, 'issueDate');
  if (!issueDate) {
    throw new XRechnungGeneratorError(
      'Invoice is missing required field "issueDate".'
    );
  }
  const dueDate = toDateOnly(invoice.dueDate);
  const deliveryDate = dueDate || issueDate;
  const currency = normalizeCurrency(invoice.currency);

  const supplierName =
    normalizeString(invoice.supplierName) || 'Unbekannter Lieferant';
  const customerName =
    normalizeString(invoice.customerName) || 'Unbekannter Kunde';

  const supplierAddress = {
    line1: normalizeString(
      rawJson.extendedData?.supplierDetails?.address?.line1
    ),
    postcode: normalizeString(
      rawJson.extendedData?.supplierDetails?.address?.postcode
    ),
    city: normalizeString(rawJson.extendedData?.supplierDetails?.address?.city),
    countryCode: normalizeCountryCode(
      rawJson.extendedData?.supplierDetails?.address?.countryCode
    ),
  };

  const customerAddress = {
    line1: normalizeString(
      rawJson.extendedData?.customerDetails?.address?.line1
    ),
    postcode: normalizeString(
      rawJson.extendedData?.customerDetails?.address?.postcode
    ),
    city: normalizeString(rawJson.extendedData?.customerDetails?.address?.city),
    countryCode: normalizeCountryCode(
      rawJson.extendedData?.customerDetails?.address?.countryCode
    ),
  };

  const defaultTaxRate = getDefaultTaxRate(
    invoice.netAmount,
    invoice.taxAmount
  );
  const preparedLineItems = buildPreparedLineItems(
    invoice,
    rawJson,
    defaultTaxRate
  );
  const taxSubtotals = buildTaxSubtotals(preparedLineItems);

  const lineExtensionTotal = roundMoney(
    toNumber(invoice.netAmount) ??
      preparedLineItems.reduce((sum, item) => sum + item.netAmount, 0)
  );
  const taxTotal = roundMoney(
    toNumber(invoice.taxAmount) ??
      preparedLineItems.reduce((sum, item) => sum + item.taxAmount, 0)
  );
  const taxInclusiveTotal = roundMoney(
    toNumber(invoice.grossAmount) ?? lineExtensionTotal + taxTotal
  );

  const invoiceData = {
    'ubl:Invoice': {
      'cbc:ID': invoiceNumber,
      'cbc:IssueDate': issueDate,
      'cbc:DueDate': dueDate,
      'cbc:InvoiceTypeCode': '380',
      'cbc:DocumentCurrencyCode': currency,
      'cac:AccountingSupplierParty': {
        'cac:Party': {
          'cac:PostalAddress': {
            'cbc:StreetName': supplierAddress.line1,
            'cbc:PostalZone': supplierAddress.postcode,
            'cbc:CityName': supplierAddress.city,
            'cac:Country': {
              'cbc:IdentificationCode': supplierAddress.countryCode,
            },
          },
          'cac:PartyLegalEntity': {
            'cbc:RegistrationName': supplierName,
          },
        },
      },
      'cac:AccountingCustomerParty': {
        'cac:Party': {
          'cac:PostalAddress': {
            'cbc:StreetName': customerAddress.line1,
            'cbc:PostalZone': customerAddress.postcode,
            'cbc:CityName': customerAddress.city,
            'cac:Country': {
              'cbc:IdentificationCode': customerAddress.countryCode,
            },
          },
          'cac:PartyLegalEntity': {
            'cbc:RegistrationName': customerName,
          },
        },
      },
      'cac:Delivery': {
        'cbc:ActualDeliveryDate': deliveryDate,
      },
      'cac:TaxTotal': [
        {
          'cbc:TaxAmount': formatMoney(taxTotal),
          'cbc:TaxAmount@currencyID': currency,
          'cac:TaxSubtotal': taxSubtotals.map((subtotal) => ({
            'cbc:TaxableAmount': formatMoney(subtotal.taxableAmount),
            'cbc:TaxableAmount@currencyID': currency,
            'cbc:TaxAmount': formatMoney(subtotal.taxAmount),
            'cbc:TaxAmount@currencyID': currency,
            'cac:TaxCategory': {
              'cbc:ID': subtotal.taxCategoryCode,
              'cbc:Percent': formatRate(subtotal.taxRate),
              'cac:TaxScheme': {
                'cbc:ID': 'VAT',
              },
            },
          })),
        },
      ],
      'cac:LegalMonetaryTotal': {
        'cbc:LineExtensionAmount': formatMoney(lineExtensionTotal),
        'cbc:LineExtensionAmount@currencyID': currency,
        'cbc:TaxExclusiveAmount': formatMoney(lineExtensionTotal),
        'cbc:TaxExclusiveAmount@currencyID': currency,
        'cbc:TaxInclusiveAmount': formatMoney(taxInclusiveTotal),
        'cbc:TaxInclusiveAmount@currencyID': currency,
        'cbc:PayableAmount': formatMoney(taxInclusiveTotal),
        'cbc:PayableAmount@currencyID': currency,
      },
      'cac:InvoiceLine': preparedLineItems.map((item) => ({
        'cbc:ID': String(item.positionIndex),
        'cbc:InvoicedQuantity': formatQuantity(item.quantity),
        'cbc:InvoicedQuantity@unitCode': DEFAULT_UNIT_CODE,
        'cbc:LineExtensionAmount': formatMoney(item.netAmount),
        'cbc:LineExtensionAmount@currencyID': currency,
        'cac:Item': {
          'cbc:Name': item.description,
          'cac:ClassifiedTaxCategory': {
            'cbc:ID': item.taxCategoryCode,
            'cbc:Percent': formatRate(item.taxRate),
            'cac:TaxScheme': {
              'cbc:ID': 'VAT',
            },
          },
        },
        'cac:Price': {
          'cbc:PriceAmount': formatMoney(item.unitPrice),
          'cbc:PriceAmount@currencyID': currency,
        },
      })),
    },
  };

  return stripUndefinedDeep(invoiceData) as EInvoiceData;
}

function buildPreparedLineItems(
  invoice: XRechnungGeneratorInput,
  rawJson: InvoiceRawJsonPayload,
  defaultTaxRate: number
): PreparedLineItem[] {
  const linesFromDb = [...(invoice.lineItems || [])].sort(
    (a, b) => a.positionIndex - b.positionIndex
  );

  const preparedFromDb = linesFromDb
    .map((item) => mapDbLineItem(item, defaultTaxRate))
    .filter((item): item is PreparedLineItem => item !== null);

  if (preparedFromDb.length > 0) {
    return preparedFromDb;
  }

  const rawLineItems = rawJson.extendedData?.lineItems || [];
  const preparedFromRaw = rawLineItems
    .map((item, index) => mapRawLineItem(item, index + 1, defaultTaxRate))
    .filter((item): item is PreparedLineItem => item !== null);

  if (preparedFromRaw.length > 0) {
    return preparedFromRaw;
  }

  const fallbackNet = toNumber(invoice.netAmount);
  const fallbackTax = toNumber(invoice.taxAmount);
  const fallbackGross = toNumber(invoice.grossAmount);

  if (fallbackNet === undefined && fallbackGross === undefined) {
    throw new XRechnungGeneratorError(
      'Invoice has no usable line item data and no fallback totals.'
    );
  }

  const netAmount = roundMoney(fallbackNet ?? fallbackGross ?? 0);
  const taxAmount = roundMoney(
    fallbackTax ?? Math.max((fallbackGross ?? netAmount) - netAmount, 0)
  );
  const grossAmount = roundMoney(fallbackGross ?? netAmount + taxAmount);

  return [
    {
      positionIndex: 1,
      description: normalizeString(invoice.number) || 'Rechnungsposition',
      quantity: 1,
      unitPrice: netAmount,
      netAmount,
      taxRate: defaultTaxRate,
      taxAmount,
      grossAmount,
      taxCategoryCode: defaultTaxRate > 0 ? 'S' : 'Z',
    },
  ];
}

function mapDbLineItem(
  item: DbInvoiceLineItem,
  defaultTaxRate: number
): PreparedLineItem | null {
  const quantity = toPositiveNumber(item.quantity, 1);
  const netAmount = toNumber(item.netAmount);
  const unitPrice = toNumber(item.unitPrice);
  const taxRate = toNumber(item.taxRate) ?? defaultTaxRate;
  const taxAmount = toNumber(item.taxAmount);
  const grossAmount = toNumber(item.grossAmount);

  const computedNet = roundMoney(
    netAmount ?? (unitPrice !== undefined ? unitPrice * quantity : NaN)
  );

  if (!Number.isFinite(computedNet)) {
    return null;
  }

  const computedTax = roundMoney(
    taxAmount ??
      (grossAmount !== undefined
        ? grossAmount - computedNet
        : computedNet * (taxRate / 100))
  );

  const computedGross = roundMoney(grossAmount ?? computedNet + computedTax);
  const computedUnitPrice = roundMoney(
    unitPrice ?? (quantity > 0 ? computedNet / quantity : computedNet)
  );

  return {
    positionIndex: item.positionIndex,
    description:
      normalizeString(item.description) || `Position ${item.positionIndex}`,
    quantity,
    unitPrice: computedUnitPrice,
    netAmount: computedNet,
    taxRate: roundRate(taxRate),
    taxAmount: computedTax,
    grossAmount: computedGross,
    taxCategoryCode: taxRate > 0 ? 'S' : 'Z',
  };
}

function mapRawLineItem(
  item: InvoiceRawJsonLineItem,
  positionIndex: number,
  defaultTaxRate: number
): PreparedLineItem | null {
  const quantity = toPositiveNumber(item.quantity, 1);
  const unitPrice = toNumber(item.unitPrice);
  const lineTotal = toNumber(item.totalAmount);
  const netAmount = roundMoney(
    lineTotal ?? (unitPrice !== undefined ? unitPrice * quantity : NaN)
  );

  if (!Number.isFinite(netAmount)) {
    return null;
  }

  const taxRate = roundRate(defaultTaxRate);
  const taxAmount = roundMoney(netAmount * (taxRate / 100));
  const grossAmount = roundMoney(netAmount + taxAmount);

  return {
    positionIndex,
    description:
      normalizeString(item.description) ||
      normalizeString(item.name) ||
      `Position ${positionIndex}`,
    quantity,
    unitPrice: roundMoney(
      unitPrice ?? (quantity > 0 ? netAmount / quantity : netAmount)
    ),
    netAmount,
    taxRate,
    taxAmount,
    grossAmount,
    taxCategoryCode: taxRate > 0 ? 'S' : 'Z',
  };
}

function buildTaxSubtotals(lineItems: PreparedLineItem[]): TaxSubtotal[] {
  const grouped = new Map<string, TaxSubtotal>();

  for (const item of lineItems) {
    const key = `${item.taxCategoryCode}-${formatRate(item.taxRate)}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.taxableAmount = roundMoney(
        existing.taxableAmount + item.netAmount
      );
      existing.taxAmount = roundMoney(existing.taxAmount + item.taxAmount);
      continue;
    }

    grouped.set(key, {
      taxRate: item.taxRate,
      taxCategoryCode: item.taxCategoryCode,
      taxableAmount: roundMoney(item.netAmount),
      taxAmount: roundMoney(item.taxAmount),
    });
  }

  return [...grouped.values()].sort((a, b) => a.taxRate - b.taxRate);
}

function getDefaultTaxRate(netAmount: unknown, taxAmount: unknown): number {
  const net = toNumber(netAmount);
  const tax = toNumber(taxAmount);

  if (!net || !tax) {
    return 0;
  }

  return roundRate((tax / net) * 100);
}

function getRawJsonPayload(rawJson: unknown): InvoiceRawJsonPayload {
  if (!isRecord(rawJson)) {
    return {};
  }

  const extendedData = asRecord(rawJson.extendedData);

  return {
    extendedData: extendedData
      ? {
          supplierDetails: mapRawJsonParty(extendedData.supplierDetails),
          customerDetails: mapRawJsonParty(extendedData.customerDetails),
          lineItems: Array.isArray(extendedData.lineItems)
            ? extendedData.lineItems.map(mapRawJsonLineItem)
            : undefined,
        }
      : undefined,
  };
}

function mapRawJsonParty(value: unknown): InvoiceRawJsonParty | undefined {
  const rec = asRecord(value);
  const address = asRecord(rec?.address);

  if (!rec && !address) {
    return undefined;
  }

  return {
    address: address
      ? {
          line1: normalizeString(address.line1),
          postcode: normalizeString(address.postcode),
          city: normalizeString(address.city),
          countryCode: normalizeString(address.countryCode),
        }
      : undefined,
  };
}

function mapRawJsonLineItem(value: unknown): InvoiceRawJsonLineItem {
  const rec = asRecord(value);
  return {
    name: normalizeString(rec?.name),
    description: normalizeString(rec?.description),
    quantity: normalizeString(rec?.quantity),
    unitPrice: normalizeString(rec?.unitPrice),
    totalAmount: normalizeString(rec?.totalAmount),
  };
}

function validateXRechnungProfile(xml: string): string[] {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTagValue: false,
    });
    const parsed = parser.parse(xml);
    const cii = asRecord(
      (parsed as Record<string, unknown>)['rsm:CrossIndustryInvoice'] ||
        (parsed as Record<string, unknown>).CrossIndustryInvoice
    );
    const context = asRecord(
      cii?.['rsm:ExchangedDocumentContext'] || cii?.ExchangedDocumentContext
    );
    const guideline = asRecord(
      context?.['ram:GuidelineSpecifiedDocumentContextParameter'] ||
        context?.GuidelineSpecifiedDocumentContextParameter
    );
    const profileId = normalizeString(guideline?.['ram:ID'] || guideline?.ID);

    if (!profileId || !profileId.toLowerCase().includes('xrechnung_3.0')) {
      return [
        'Generated XML is not marked as XRechnung 3.0 (missing guideline ID containing "xrechnung_3.0").',
      ];
    }

    return [];
  } catch (error) {
    return [
      `Profile detection failed: ${error instanceof Error ? error.message : 'Unknown parser error'}`,
    ];
  }
}

function resolveSchemaPath(xsdPath?: string): string {
  if (!xsdPath) {
    return DEFAULT_XSD_PATH;
  }

  return path.isAbsolute(xsdPath)
    ? xsdPath
    : path.resolve(process.cwd(), xsdPath);
}

async function ensureSchemaExists(schemaPath: string): Promise<void> {
  try {
    await access(schemaPath, fsConstants.R_OK);
  } catch {
    throw new XRechnungGeneratorError(
      `XSD schema file not found or not readable: ${schemaPath}`
    );
  }
}

function extractXmllintErrors(error: unknown): string[] {
  if (!error || typeof error !== 'object') {
    return ['Unknown xmllint validation error'];
  }

  const stdout = normalizeString((error as { stdout?: unknown }).stdout);
  const stderr = normalizeString((error as { stderr?: unknown }).stderr);
  const message = normalizeString((error as { message?: unknown }).message);

  const lines = [stdout, stderr]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split('\n'))
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.endsWith('validates'));

  if (lines.length > 0) {
    return [...new Set(lines)];
  }

  return message ? [message] : ['Unknown xmllint validation error'];
}

function toDateOnly(value: unknown, fieldName?: string): string | undefined {
  if (!value && fieldName) {
    throw new XRechnungGeneratorError(
      `Invoice is missing required field "${fieldName}".`
    );
  }

  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    if (!fieldName) {
      return undefined;
    }
    throw new XRechnungGeneratorError(
      `Invoice field "${fieldName}" is not a valid date.`
    );
  }

  return date.toISOString().slice(0, 10);
}

function normalizeCurrency(value: unknown): string {
  const normalized = normalizeString(value)?.toUpperCase();
  if (normalized && /^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }
  return 'EUR';
}

function normalizeCountryCode(value: unknown): string {
  const normalized = normalizeString(value)?.toUpperCase();
  if (normalized && /^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }
  return DEFAULT_COUNTRY_CODE;
}

function normalizeString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    let normalized = trimmed;
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(trimmed)) {
      normalized = trimmed.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d+(,\d+)$/.test(trimmed)) {
      normalized = trimmed.replace(',', '.');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    return toNumber(value.toString());
  }

  return undefined;
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = toNumber(value);
  if (parsed === undefined || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRate(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number): string {
  return roundMoney(value).toFixed(2);
}

function formatQuantity(value: number): string {
  const fixed = value.toFixed(4).replace(/\.?0+$/, '');
  return fixed.length > 0 ? fixed : '0';
}

function formatRate(value: number): string {
  return roundRate(value)
    .toFixed(2)
    .replace(/\.?0+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function stripUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry));
  }

  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) {
        continue;
      }
      output[key] = stripUndefinedDeep(entry);
    }
    return output;
  }

  return value;
}
