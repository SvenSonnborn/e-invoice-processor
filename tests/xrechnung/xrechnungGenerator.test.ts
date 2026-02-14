import { describe, expect, it } from 'bun:test';
import {
  generateXRechnung,
  generateXRechnungXML,
  type XRechnungGeneratorInput,
} from '@/src/lib/generators/xrechnungGenerator';

const baseInvoice = {
  id: 'inv_xrechnung_test_1',
  organizationId: 'org_test_1',
  fileId: null,
  createdBy: null,
  format: 'XRECHNUNG',
  number: 'RE-2026-1001',
  supplierName: 'Muster Lieferant GmbH',
  customerName: 'Muster Kunde GmbH',
  issueDate: new Date('2026-02-14T00:00:00.000Z'),
  dueDate: new Date('2026-02-28T00:00:00.000Z'),
  currency: 'EUR',
  taxId: null,
  netAmount: '100.00',
  taxAmount: '19.00',
  grossAmount: '119.00',
  rawJson: {
    extendedData: {
      supplierDetails: {
        address: {
          line1: 'Lieferstraße 1',
          postcode: '10115',
          city: 'Berlin',
          countryCode: 'DE',
        },
      },
      customerDetails: {
        address: {
          line1: 'Kundenweg 2',
          postcode: '20095',
          city: 'Hamburg',
          countryCode: 'DE',
        },
      },
    },
  },
  status: 'VALIDATED',
  lastProcessedAt: null,
  processingVersion: 1,
  gobdStatus: null,
  gobdViolations: null,
  gobdValidatedAt: null,
  createdAt: new Date('2026-02-14T00:00:00.000Z'),
  updatedAt: new Date('2026-02-14T00:00:00.000Z'),
  lineItems: [
    {
      id: 'line_xrechnung_test_1',
      invoiceId: 'inv_xrechnung_test_1',
      positionIndex: 1,
      description: 'Beratungsleistung',
      quantity: '1',
      unitPrice: '100.00',
      taxRate: '19.00',
      netAmount: '100.00',
      taxAmount: '19.00',
      grossAmount: '119.00',
      createdAt: new Date('2026-02-14T00:00:00.000Z'),
      updatedAt: new Date('2026-02-14T00:00:00.000Z'),
    },
  ],
} as unknown as XRechnungGeneratorInput;

describe('xrechnungGenerator', () => {
  it('generates XRechnung 3.0 CII XML and validates it against XSD', async () => {
    const result = await generateXRechnung(baseInvoice);

    expect(result.xml).toContain('<rsm:CrossIndustryInvoice');
    expect(result.xml.toLowerCase()).toContain('xrechnung_3.0');
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
  });

  it('returns formatted XML as string output', async () => {
    const xml = await generateXRechnungXML(baseInvoice);

    expect(typeof xml).toBe('string');
    expect(xml).toContain('\n');
    expect(xml).toContain('\t');
  });

  it('throws on missing required invoice fields', async () => {
    const invalidInvoice = {
      ...baseInvoice,
      issueDate: null,
    } as unknown as XRechnungGeneratorInput;

    await expect(generateXRechnung(invalidInvoice)).rejects.toMatchObject({
      name: 'XRechnungGeneratorError',
    });
  });
});
