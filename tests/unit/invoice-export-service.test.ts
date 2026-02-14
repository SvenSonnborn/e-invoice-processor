import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test';

let invoiceExists = true;
let invoiceStatus: 'VALIDATED' | 'EXPORTED' | 'PARSED' = 'VALIDATED';
let markAsExportedCalls = 0;
const uploadedObjects: Array<{
  key: string;
  contentType: string | undefined;
  metadata: Record<string, string> | undefined;
  bytes: number;
}> = [];

let generateInvoiceExport: (input: {
  organizationId: string;
  invoiceId: string;
  format: 'xrechnung' | 'zugferd';
}) => Promise<{
  filename: string;
  contentType: string;
  fileBuffer: Buffer;
  storageKey: string;
}>;

const reviewData = {
  header: {
    profile: 'XRECHNUNG_B2G',
    invoiceNumber: 'RE-2026-1001',
    issueDate: '2026-02-12',
    currency: 'EUR',
    dueDate: '2026-02-20',
    buyerReference: 'DE-LEITWEG-123',
  },
  seller: {
    name: 'Muster Lieferant GmbH',
    street: 'Lieferweg 1',
    postCode: '10115',
    city: 'Berlin',
    countryCode: 'DE',
    vatId: 'DE123456789',
    taxNumber: '',
  },
  buyer: {
    name: 'Muster Kunde AG',
    street: 'Kundenstrasse 2',
    postCode: '80331',
    city: 'Muenchen',
    countryCode: 'DE',
  },
  payment: {
    means: 'bankTransfer',
    iban: 'DE44500105175407324931',
    termsText: '14 Tage netto',
  },
  lines: [
    {
      description: 'Beratung',
      quantity: 1,
      unit: 'Stk',
      unitPrice: 100,
      netAmount: 100,
      vatRate: 19,
      vatCategory: 'S',
    },
  ],
  totals: {
    netAmount: 100,
    vatAmount: 19,
    grossAmount: 119,
  },
  taxBreakdown: [
    {
      rate: 19,
      taxableAmount: 100,
      taxAmount: 19,
    },
  ],
} as const;

beforeAll(async () => {
  mock.module('@/src/lib/db/client', () => ({
    prisma: {
      invoice: {
        findFirst: async (args: {
          where: { id: string; organizationId: string };
        }) => {
          if (!invoiceExists) return null;
          if (args.where.id !== 'inv-1') return null;
          if (args.where.organizationId !== 'org-123') return null;

          return {
            id: 'inv-1',
            organizationId: 'org-123',
            fileId: null,
            createdBy: 'user-1',
            format: 'XRECHNUNG',
            number: 'RE-2026-1001',
            supplierName: 'Muster Lieferant GmbH',
            customerName: 'Muster Kunde AG',
            issueDate: new Date('2026-02-12T00:00:00.000Z'),
            dueDate: new Date('2026-02-20T00:00:00.000Z'),
            currency: 'EUR',
            taxId: 'DE123456789',
            netAmount: '100.00',
            taxAmount: '19.00',
            grossAmount: '119.00',
            rawJson: { reviewData },
            status: invoiceStatus,
            lastProcessedAt: new Date('2026-02-12T00:00:00.000Z'),
            processingVersion: 2,
            gobdStatus: null,
            gobdViolations: null,
            gobdValidatedAt: null,
            createdAt: new Date('2026-02-12T00:00:00.000Z'),
            updatedAt: new Date('2026-02-12T00:00:00.000Z'),
            lineItems: [],
          };
        },
        findUnique: async (args: { where: { id: string } }) => {
          if (!invoiceExists || args.where.id !== 'inv-1') {
            return null;
          }

          return { status: invoiceStatus };
        },
        update: async (args: {
          where: { id: string };
          data: { status: 'EXPORTED' };
        }) => {
          if (args.where.id !== 'inv-1') {
            throw new Error('Invoice not found in update');
          }

          invoiceStatus = args.data.status;
          markAsExportedCalls += 1;

          return {
            id: args.where.id,
            status: invoiceStatus,
          };
        },
      },
    },
  }));

  mock.module('@/src/lib/storage', () => ({
    storage: {
      upload: async (
        key: string,
        data: Buffer,
        options?: {
          contentType?: string;
          metadata?: Record<string, string>;
        }
      ) => {
        uploadedObjects.push({
          key,
          contentType: options?.contentType,
          metadata: options?.metadata,
          bytes: data.length,
        });

        return key;
      },
    },
  }));

  mock.module('@/src/lib/logging', () => ({
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  }));

  const serviceModule = await import('@/src/server/services/invoice-export');
  generateInvoiceExport = serviceModule.generateInvoiceExport;
});

afterAll(() => {
  mock.restore?.();
});

describe('generateInvoiceExport', () => {
  beforeEach(() => {
    invoiceExists = true;
    invoiceStatus = 'VALIDATED';
    markAsExportedCalls = 0;
    uploadedObjects.length = 0;
  });

  it('generates and uploads XRechnung, then marks invoice as exported', async () => {
    const result = await generateInvoiceExport({
      organizationId: 'org-123',
      invoiceId: 'inv-1',
      format: 'xrechnung',
    });

    expect(result.filename).toBe('RE-2026-1001-xrechnung.xml');
    expect(result.contentType).toContain('application/xml');
    expect(result.fileBuffer.toString('utf-8')).toContain('<?xml');
    expect(result.storageKey).toContain('invoices/exports/org-123/inv-1/');
    expect(uploadedObjects[0].key).toContain('invoices/exports/org-123/inv-1/');
    expect(uploadedObjects[0].metadata?.format).toBe('XRECHNUNG');
    expect(markAsExportedCalls).toBe(1);
  });

  it('generates and uploads ZUGFeRD without re-marking already exported invoices', async () => {
    invoiceStatus = 'EXPORTED';

    const result = await generateInvoiceExport({
      organizationId: 'org-123',
      invoiceId: 'inv-1',
      format: 'zugferd',
    });

    expect(result.filename).toBe('RE-2026-1001-zugferd.pdf');
    expect(result.contentType).toBe('application/pdf');
    expect(result.fileBuffer.length).toBeGreaterThan(0);
    expect(result.storageKey).toContain('invoices/exports/org-123/inv-1/');
    expect(uploadedObjects[0].metadata?.format).toBe('ZUGFERD');
    expect(markAsExportedCalls).toBe(0);
  });

  it('throws INVALID_STATE when invoice is not validated/exported', async () => {
    invoiceStatus = 'PARSED';

    expect(
      generateInvoiceExport({
        organizationId: 'org-123',
        invoiceId: 'inv-1',
        format: 'xrechnung',
      })
    ).rejects.toMatchObject({
      name: 'InvoiceExportServiceError',
      code: 'INVALID_STATE',
    });
    expect(uploadedObjects).toHaveLength(0);
    expect(markAsExportedCalls).toBe(0);
  });

  it('throws NOT_FOUND when invoice is missing or outside organization scope', async () => {
    invoiceExists = false;

    expect(
      generateInvoiceExport({
        organizationId: 'org-123',
        invoiceId: 'inv-1',
        format: 'xrechnung',
      })
    ).rejects.toMatchObject({
      name: 'InvoiceExportServiceError',
      code: 'NOT_FOUND',
    });
  });
});
