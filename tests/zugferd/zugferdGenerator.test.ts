import { describe, expect, it } from 'bun:test';
import { PDFDocument, PDFName, PDFRef, PDFStream } from 'pdf-lib';
import type { InvoiceReviewFormValues } from '@/src/lib/validators/invoice-review';
import { generateZugferdPDF } from '@/src/lib/generators/zugferdGenerator';
import { extractXMLFromPDF } from '@/src/lib/zugferd/zugferd-parser';

const validatedInvoice: InvoiceReviewFormValues = {
  header: {
    profile: 'XRECHNUNG_B2G',
    invoiceNumber: 'RE-2026-1001',
    issueDate: '2026-02-14',
    currency: 'EUR',
    dueDate: '2026-02-28',
    buyerReference: 'DE-LEITWEG-123',
  },
  seller: {
    name: 'Muster Lieferant GmbH',
    street: 'Lieferstraße 1',
    postCode: '10115',
    city: 'Berlin',
    countryCode: 'DE',
    vatId: 'DE123456789',
    taxNumber: undefined,
  },
  buyer: {
    name: 'Muster Kunde GmbH',
    street: 'Kundenweg 2',
    postCode: '20095',
    city: 'Hamburg',
    countryCode: 'DE',
  },
  payment: {
    means: 'bankTransfer',
    iban: 'DE44500105175407324931',
    termsText: 'Zahlbar innerhalb von 14 Tagen',
  },
  lines: [
    {
      description: 'Beratungsleistung',
      quantity: 1,
      unit: 'C62',
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
};

const xrechnungXml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100">
  <rsm:ExchangedDocument>
    <ram:ID>RE-2026-1001</ram:ID>
  </rsm:ExchangedDocument>
  <ram:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>Muster Lieferant GmbH</ram:Name>
      </ram:SellerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
  </ram:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

describe('zugferdGenerator', () => {
  it('generates ZUGFeRD from validated invoice + XML and embeds metadata', async () => {
    const result = await generateZugferdPDF({
      validatedInvoice,
      xrechnungXml,
      outputBaseFilename: 'rechnung-2026.pdf',
    });

    expect(result.filename).toBe('rechnung-2026-zugferd.pdf');
    expect(result.metadata.attachmentName).toBe('factur-x.xml');
    expect(result.metadata.zugferdVersion).toBe('2.4');
    expect(result.metadata.conformanceLevel).toBe('XRECHNUNG');
    expect(result.metadata.invoiceNumber).toBe('RE-2026-1001');

    const generatedDoc = await PDFDocument.load(result.pdf);
    expect(generatedDoc.getPageCount()).toBeGreaterThan(0);

    const extractedXml = await extractXMLFromPDF(result.pdf);
    expect(extractedXml).toBe(xrechnungXml.trim());

    const metadataXml = readMetadataXml(generatedDoc);
    expect(metadataXml).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(metadataXml).toContain('<pdfaid:conformance>B</pdfaid:conformance>');
    expect(metadataXml).toContain(
      '<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>'
    );
    expect(metadataXml).toContain('<fx:Version>2.4</fx:Version>');
    expect(metadataXml).toContain(
      '<fx:ConformanceLevel>XRECHNUNG</fx:ConformanceLevel>'
    );
  });

  it('uses invoice number for filename when no output base filename is provided', async () => {
    const result = await generateZugferdPDF(
      {
        validatedInvoice,
        xrechnungXml,
      },
      {
        attachmentName: 'zugferd-invoice.xml',
        conformanceLevel: 'EN 16931',
      }
    );

    expect(result.filename).toBe('RE-2026-1001-zugferd.pdf');
    expect(result.metadata.attachmentName).toBe('zugferd-invoice.xml');
    expect(result.metadata.conformanceLevel).toBe('EN 16931');

    const metadataXml = readMetadataXml(await PDFDocument.load(result.pdf));
    expect(metadataXml).toContain(
      '<fx:DocumentFileName>zugferd-invoice.xml</fx:DocumentFileName>'
    );
    expect(metadataXml).toContain(
      '<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>'
    );
  });

  it('throws a typed error for missing validated invoice input', async () => {
    await expect(
      generateZugferdPDF({
        validatedInvoice: null as unknown as InvoiceReviewFormValues,
        xrechnungXml,
      })
    ).rejects.toMatchObject({
      name: 'ZugferdGeneratorError',
    });
  });
});

function readMetadataXml(pdfDoc: PDFDocument): string {
  const metadataRef = pdfDoc.catalog.get(PDFName.of('Metadata')) as
    | PDFRef
    | undefined;
  expect(metadataRef).toBeDefined();

  const metadataStream = pdfDoc.context.lookup(metadataRef!) as
    | PDFStream
    | undefined;
  expect(metadataStream).toBeDefined();

  const bytes = (
    metadataStream as unknown as {
      getContents(): Uint8Array;
    }
  ).getContents();

  return new TextDecoder('utf-8').decode(bytes);
}
