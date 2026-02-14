import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  AFRelationship,
  PDFFont,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
  StandardFonts,
} from 'pdf-lib';
import type { InvoiceReviewFormValues } from '@/src/lib/validators/invoice-review';

export type ZugferdAttachmentName = 'factur-x.xml' | 'zugferd-invoice.xml';

export interface ZugferdGeneratorInput {
  validatedInvoice: InvoiceReviewFormValues;
  xrechnungXml: string;
  outputBaseFilename?: string;
}

export interface ZugferdGeneratorOptions {
  attachmentName?: ZugferdAttachmentName;
  zugferdVersion?: string;
  conformanceLevel?: string;
  creator?: string;
  producer?: string;
  language?: string;
}

export interface ZugferdGenerationMetadata {
  attachmentName: ZugferdAttachmentName;
  zugferdVersion: string;
  conformanceLevel: string;
  invoiceNumber: string;
}

export interface ZugferdGenerationResult {
  filename: string;
  pdf: Uint8Array;
  metadata: ZugferdGenerationMetadata;
}

export class ZugferdGeneratorError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ZugferdGeneratorError';
  }
}

const DEFAULT_ATTACHMENT_NAME: ZugferdAttachmentName = 'factur-x.xml';
const DEFAULT_ZUGFERD_VERSION = '2.4';
const DEFAULT_CONFORMANCE_LEVEL = 'XRECHNUNG';
const DEFAULT_LANGUAGE = 'de-DE';
const DEFAULT_PRODUCER = 'e-rechnung ZUGFeRD generator';
const ALLOWED_ATTACHMENT_NAMES = new Set<ZugferdAttachmentName>([
  'factur-x.xml',
  'zugferd-invoice.xml',
]);

const SRGB_ICC_PROFILE_BASE64 = `
AAAL0AAAAAACAAAAbW50clJHQiBYWVogB98AAgAPAAAAAAAAYWNzcAAAAAAAAAAAAAAAAAAAAAAA
AAABAAAAAAAAAAAAAPbWAAEAAAAA0y0AAAAAPQ6y3q6Tl76bZybOjApDzgAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAQZGVzYwAAAUQAAABjYlhZWgAAAagAAAAUYlRSQwAAAbwAAAgMZ1RS
QwAAAbwAAAgMclRSQwAAAbwAAAgMZG1kZAAACcgAAACIZ1hZWgAAClAAAAAUbHVtaQAACmQAAAAU
bWVhcwAACngAAAAkYmtwdAAACpwAAAAUclhZWgAACrAAAAAUdGVjaAAACsQAAAAMdnVlZAAACtAA
AACHd3RwdAAAC1gAAAAUY3BydAAAC2wAAAA3Y2hhZAAAC6QAAAAsZGVzYwAAAAAAAAAJc1JHQjIw
MTQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAAAkoAAAD4QAALbPY3VydgAAAAAAAAQA
AAAABQAKAA8AFAAZAB4AIwAoAC0AMgA3ADsAQABFAEoATwBUAFkAXgBjAGgAbQByAHcAfACBAIYA
iwCQAJUAmgCfAKQAqQCuALIAtwC8AMEAxgDLANAA1QDbAOAA5QDrAPAA9gD7AQEBBwENARMBGQEf
ASUBKwEyATgBPgFFAUwBUgFZAWABZwFuAXUBfAGDAYsBkgGaAaEBqQGxAbkBwQHJAdEB2QHhAekB
8gH6AgMCDAIUAh0CJgIvAjgCQQJLAlQCXQJnAnECegKEAo4CmAKiAqwCtgLBAssC1QLgAusC9QMA
AwsDFgMhAy0DOANDA08DWgNmA3IDfgOKA5YDogOuA7oDxwPTA+AD7AP5BAYEEwQgBC0EOwRIBFUE
YwRxBH4EjASaBKgEtgTEBNME4QTwBP4FDQUcBSsFOgVJBVgFZwV3BYYFlgWmBbUFxQXVBeUF9gYG
BhYGJwY3BkgGWQZqBnsGjAadBq8GwAbRBuMG9QcHBxkHKwc9B08HYQd0B4YHmQesB78H0gflB/gI
CwgfCDIIRghaCG4IggiWCKoIvgjSCOcI+wkQCSUJOglPCWQJeQmPCaQJugnPCeUJ+woRCicKPQpU
CmoKgQqYCq4KxQrcCvMLCwsiCzkLUQtpC4ALmAuwC8gL4Qv5DBIMKgxDDFwMdQyODKcMwAzZDPMN
DQ0mDUANWg10DY4NqQ3DDd4N+A4TDi4OSQ5kDn8Omw62DtIO7g8JDyUPQQ9eD3oPlg+zD88P7BAJ
ECYQQxBhEH4QmxC5ENcQ9RETETERTxFtEYwRqhHJEegSBxImEkUSZBKEEqMSwxLjEwMTIxNDE2MT
gxOkE8UT5RQGFCcUSRRqFIsUrRTOFPAVEhU0FVYVeBWbFb0V4BYDFiYWSRZsFo8WshbWFvoXHRdB
F2UXiReuF9IX9xgbGEAYZRiKGK8Y1Rj6GSAZRRlrGZEZtxndGgQaKhpRGncanhrFGuwbFBs7G2Mb
ihuyG9ocAhwqHFIcexyjHMwc9R0eHUcdcB2ZHcMd7B4WHkAeah6UHr4e6R8THz4faR+UH78f6iAV
IEEgbCCYIMQg8CEcIUghdSGhIc4h+yInIlUigiKvIt0jCiM4I2YjlCPCI/AkHyRNJHwkqyTaJQkl
OCVoJZclxyX3JicmVyaHJrcm6CcYJ0kneierJ9woDSg/KHEooijUKQYpOClrKZ0p0CoCKjUqaCqb
Ks8rAis2K2krnSvRLAUsOSxuLKIs1y0MLUEtdi2rLeEuFi5MLoIuty7uLyQvWi+RL8cv/jA1MGww
pDDbMRIxSjGCMbox8jIqMmMymzLUMw0zRjN/M7gz8TQrNGU0njTYNRM1TTWHNcI1/TY3NnI2rjbp
NyQ3YDecN9c4FDhQOIw4yDkFOUI5fzm8Ofk6Njp0OrI67zstO2s7qjvoPCc8ZTykPOM9Ij1hPaE9
4D4gPmA+oD7gPyE/YT+iP+JAI0BkQKZA50EpQWpBrEHuQjBCckK1QvdDOkN9Q8BEA0RHRIpEzkUS
RVVFmkXeRiJGZ0arRvBHNUd7R8BIBUhLSJFI10kdSWNJqUnwSjdKfUrESwxLU0uaS+JMKkxyTLpN
Ak1KTZNN3E4lTm5Ot08AT0lPk0/dUCdQcVC7UQZRUFGbUeZSMVJ8UsdTE1NfU6pT9lRCVI9U21Uo
VXVVwlYPVlxWqVb3V0RXklfgWC9YfVjLWRpZaVm4WgdaVlqmWvVbRVuVW+VcNVyGXNZdJ114Xcle
Gl5sXr1fD19hX7NgBWBXYKpg/GFPYaJh9WJJYpxi8GNDY5dj62RAZJRk6WU9ZZJl52Y9ZpJm6Gc9
Z5Nn6Wg/aJZo7GlDaZpp8WpIap9q92tPa6dr/2xXbK9tCG1gbbluEm5rbsRvHm94b9FwK3CGcOBx
OnGVcfByS3KmcwFzXXO4dBR0cHTMdSh1hXXhdj52m3b4d1Z3s3gReG54zHkqeYl553pGeqV7BHtj
e8J8IXyBfOF9QX2hfgF+Yn7CfyN/hH/lgEeAqIEKgWuBzYIwgpKC9INXg7qEHYSAhOOFR4Wrhg6G
cobXhzuHn4gEiGmIzokziZmJ/opkisqLMIuWi/yMY4zKjTGNmI3/jmaOzo82j56QBpBukNaRP5Go
khGSepLjk02TtpQglIqU9JVflcmWNJaflwqXdZfgmEyYuJkkmZCZ/JpomtWbQpuvnByciZz3nWSd
0p5Anq6fHZ+Ln/qgaaDYoUehtqImopajBqN2o+akVqTHpTilqaYapoum/adup+CoUqjEqTepqaoc
qo+rAqt1q+msXKzQrUStuK4trqGvFq+LsACwdbDqsWCx1rJLssKzOLOutCW0nLUTtYq2AbZ5tvC3
aLfguFm40blKucK6O7q1uy67p7whvJu9Fb2Pvgq+hL7/v3q/9cBwwOzBZ8Hjwl/C28NYw9TEUcTO
xUvFyMZGxsPHQce/yD3IvMk6ybnKOMq3yzbLtsw1zLXNNc21zjbOts83z7jQOdC60TzRvtI/0sHT
RNPG1EnUy9VO1dHWVdbY11zX4Nhk2OjZbNnx2nba+9uA3AXcit0Q3ZbeHN6i3ynfr+A24L3hROHM
4lPi2+Nj4+vkc+T85YTmDeaW5x/nqegy6LzpRunQ6lvq5etw6/vshu0R7ZzuKO6070DvzPBY8OXx
cvH/8ozzGfOn9DT0wvVQ9d72bfb794r4Gfio+Tj5x/pX+uf7d/wH/Jj9Kf26/kv+3P9t//9kZXNj
AAAAAAAAAC5JRUMgNjE5NjYtMi0xIERlZmF1bHQgUkdCIENvbG91ciBTcGFjZSAtIHNSR0IAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAWFlaIAAAAAAAAGKZAAC3hQAAGNpYWVogAAAAAAAAAAAAUAAAAAAA
AG1lYXMAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlhZWiAAAAAAAAAAngAAAKQAAACH
WFlaIAAAAAAAAG+iAAA49QAAA5BzaWcgAAAAAENSVCBkZXNjAAAAAAAAAC1SZWZlcmVuY2UgVmll
d2luZyBDb25kaXRpb24gaW4gSUVDIDYxOTY2LTItMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWFla
IAAAAAAAAPbWAAEAAAAA0y10ZXh0AAAAAENvcHlyaWdodCBJbnRlcm5hdGlvbmFsIENvbG9yIENv
bnNvcnRpdW0sIDIwMTUAAHNmMzIAAAAAAAEMRAAABd////MmAAAHlAAA/Y////uh///9ogAAA9sA
AMB1
`.trim();

interface XmpMetadataInput {
  attachmentName: ZugferdAttachmentName;
  creator: string;
  subject: string;
  producedAt: string;
  producer: string;
  zugferdVersion: string;
  conformanceLevel: string;
}

export async function generateZugferdPDF(
  input: ZugferdGeneratorInput,
  options: ZugferdGeneratorOptions = {}
): Promise<ZugferdGenerationResult> {
  const validatedInvoice = ensureValidatedInvoice(input.validatedInvoice);
  const xml = normalizeXml(input.xrechnungXml);
  const attachmentName = resolveAttachmentName(options.attachmentName);
  const zugferdVersion = normalizeOption(
    options.zugferdVersion,
    DEFAULT_ZUGFERD_VERSION
  );
  const conformanceLevel = normalizeOption(
    options.conformanceLevel,
    DEFAULT_CONFORMANCE_LEVEL
  );
  const language = normalizeOption(options.language, DEFAULT_LANGUAGE);
  const producer = normalizeOption(options.producer, DEFAULT_PRODUCER);
  const invoiceNumber =
    validatedInvoice.header.invoiceNumber.trim() || extractInvoiceNumber(xml);
  const creator = normalizeOption(
    options.creator,
    validatedInvoice.seller.name.trim() || 'E-Rechnung'
  );

  const now = new Date();
  const subject = `Invoice ${invoiceNumber}`;
  const outputFilename = buildOutputFilename(
    validatedInvoice,
    input.outputBaseFilename
  );

  try {
    const pdfDoc = await PDFDocument.create({ updateMetadata: false });
    await renderValidatedInvoicePdf(pdfDoc, validatedInvoice);

    await pdfDoc.attach(new TextEncoder().encode(xml), attachmentName, {
      mimeType: 'text/xml',
      description: 'XRechnung XML',
      creationDate: now,
      modificationDate: now,
      afRelationship: AFRelationship.Alternative,
    });

    pdfDoc.setAuthor(creator);
    pdfDoc.setCreationDate(now);
    pdfDoc.setCreator(producer);
    pdfDoc.setKeywords(['Invoice', 'Factur-X', 'ZUGFeRD', 'XRechnung']);
    pdfDoc.setLanguage(language);
    pdfDoc.setModificationDate(now);
    pdfDoc.setProducer(producer);
    pdfDoc.setSubject(subject);
    pdfDoc.setTitle(`${creator}: ${subject}`);

    setTrailerInfoId(pdfDoc, `${subject}|${xml}`);
    setOutputIntent(pdfDoc);
    fixLinkAnnotations(pdfDoc);
    setMarkInfo(pdfDoc);
    setStructTreeRoot(pdfDoc);
    addMetadata(
      pdfDoc,
      buildXmpMetadata({
        attachmentName,
        creator,
        subject,
        producedAt: formatDateWithOffset(now),
        producer,
        zugferdVersion,
        conformanceLevel,
      })
    );

    const outputPdf = await pdfDoc.save({
      useObjectStreams: false,
      updateFieldAppearances: false,
    });

    return {
      filename: outputFilename,
      pdf: outputPdf,
      metadata: {
        attachmentName,
        zugferdVersion,
        conformanceLevel,
        invoiceNumber,
      },
    };
  } catch (error) {
    throw new ZugferdGeneratorError(
      'Failed to generate ZUGFeRD PDF from validated invoice and XML.',
      error instanceof Error ? error : undefined
    );
  }
}

function resolveAttachmentName(
  attachmentName: string | undefined
): ZugferdAttachmentName {
  const normalized = normalizeOption(attachmentName, DEFAULT_ATTACHMENT_NAME);
  if (!ALLOWED_ATTACHMENT_NAMES.has(normalized as ZugferdAttachmentName)) {
    throw new ZugferdGeneratorError(
      `Invalid attachment name "${normalized}". Expected "factur-x.xml" or "zugferd-invoice.xml".`
    );
  }
  return normalized as ZugferdAttachmentName;
}

function normalizeXml(xml: string): string {
  const normalized = xml?.trim();
  if (!normalized) {
    throw new ZugferdGeneratorError('XRechnung XML is required.');
  }
  if (!normalized.startsWith('<')) {
    throw new ZugferdGeneratorError(
      'Invalid XRechnung XML input. Expected XML content as text.'
    );
  }
  return normalized;
}

function normalizeOption(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function ensureValidatedInvoice(
  value: InvoiceReviewFormValues | null | undefined
): InvoiceReviewFormValues {
  if (!value) {
    throw new ZugferdGeneratorError('validatedInvoice is required.');
  }
  if (!value.header?.invoiceNumber?.trim()) {
    throw new ZugferdGeneratorError(
      'validatedInvoice.header.invoiceNumber is required.'
    );
  }
  if (!value.seller?.name?.trim()) {
    throw new ZugferdGeneratorError(
      'validatedInvoice.seller.name is required.'
    );
  }
  if (!value.buyer?.name?.trim()) {
    throw new ZugferdGeneratorError('validatedInvoice.buyer.name is required.');
  }
  if (!Array.isArray(value.lines) || value.lines.length === 0) {
    throw new ZugferdGeneratorError(
      'validatedInvoice.lines must contain at least one line item.'
    );
  }
  return value;
}

function buildOutputFilename(
  validatedInvoice: InvoiceReviewFormValues,
  outputBaseFilename?: string
): string {
  if (outputBaseFilename?.trim()) {
    const parsed = path.parse(outputBaseFilename.trim());
    const base = parsed.name || 'invoice';
    return `${base}-zugferd.pdf`;
  }
  const base = sanitizeFilenameSegment(validatedInvoice.header.invoiceNumber);
  return `${base}-zugferd.pdf`;
}

function extractInvoiceNumber(xml: string): string {
  const candidates = [
    /<ram:ID[^>]*>([^<]+)<\/ram:ID>/i,
    /<cbc:ID[^>]*>([^<]+)<\/cbc:ID>/i,
    /<ID[^>]*>([^<]+)<\/ID>/i,
  ];
  for (const candidate of candidates) {
    const match = xml.match(candidate);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return 'invoice';
}

function sanitizeFilenameSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return cleaned || 'invoice';
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 48;
const LINE_HEIGHT = 14;
const TEXT_SIZE = 10;

async function renderValidatedInvoicePdf(
  pdfDoc: PDFDocument,
  invoice: InvoiceReviewFormValues
): Promise<void> {
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;

  const startNewPageIfNeeded = (requiredHeight: number = LINE_HEIGHT) => {
    if (cursorY - requiredHeight >= PAGE_MARGIN) {
      return;
    }
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - PAGE_MARGIN;
  };

  const drawLine = (
    text: string,
    opts: { font?: PDFFont; size?: number; x?: number } = {}
  ) => {
    startNewPageIfNeeded();
    page.drawText(text, {
      x: opts.x ?? PAGE_MARGIN,
      y: cursorY,
      size: opts.size ?? TEXT_SIZE,
      font: opts.font ?? regular,
    });
    cursorY -= LINE_HEIGHT;
  };

  const spacer = (height: number = LINE_HEIGHT / 2) => {
    cursorY -= height;
    startNewPageIfNeeded();
  };

  const currency = invoice.header.currency.toUpperCase();

  drawLine(`Invoice ${invoice.header.invoiceNumber}`, { font: bold, size: 18 });
  drawLine(`Issue date: ${invoice.header.issueDate}  Currency: ${currency}`, {
    font: regular,
  });
  if (invoice.header.dueDate) {
    drawLine(`Due date: ${invoice.header.dueDate}`, { font: regular });
  }
  if (invoice.header.buyerReference) {
    drawLine(`Buyer reference: ${invoice.header.buyerReference}`, {
      font: regular,
    });
  }
  spacer();

  drawLine('Seller', { font: bold, size: 12 });
  drawLine(invoice.seller.name);
  drawLine(
    `${invoice.seller.street}, ${invoice.seller.postCode} ${invoice.seller.city}, ${invoice.seller.countryCode}`
  );
  if (invoice.seller.vatId) {
    drawLine(`VAT ID: ${invoice.seller.vatId}`);
  } else if (invoice.seller.taxNumber) {
    drawLine(`Tax number: ${invoice.seller.taxNumber}`);
  }
  spacer();

  drawLine('Buyer', { font: bold, size: 12 });
  drawLine(invoice.buyer.name);
  drawLine(
    `${invoice.buyer.street}, ${invoice.buyer.postCode} ${invoice.buyer.city}, ${invoice.buyer.countryCode}`
  );
  spacer();

  drawLine('Line items', { font: bold, size: 12 });
  for (let index = 0; index < invoice.lines.length; index += 1) {
    const line = invoice.lines[index];
    drawLine(`${index + 1}. ${line.description}`);
    drawLine(
      `   Qty ${formatDecimal(line.quantity)} ${line.unit} | Unit ${formatMoney(line.unitPrice, currency)} | Net ${formatMoney(line.netAmount, currency)} | VAT ${line.vatRate}%`
    );
  }
  spacer();

  drawLine('Totals', { font: bold, size: 12 });
  drawLine(`Net: ${formatMoney(invoice.totals.netAmount, currency)}`);
  drawLine(`VAT: ${formatMoney(invoice.totals.vatAmount, currency)}`);
  drawLine(`Gross: ${formatMoney(invoice.totals.grossAmount, currency)}`, {
    font: bold,
  });
  spacer();

  drawLine('Payment', { font: bold, size: 12 });
  drawLine(`Means: ${invoice.payment.means}`);
  if (invoice.payment.iban) {
    drawLine(`IBAN: ${invoice.payment.iban}`);
  }
  if (invoice.payment.termsText) {
    drawLine(`Terms: ${invoice.payment.termsText}`);
  }
}

function formatMoney(value: number, currency: string): string {
  return `${formatDecimal(value)} ${currency}`;
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}

function setTrailerInfoId(pdfDoc: PDFDocument, seed: string): void {
  const hashHex = createHash('sha512').update(seed).digest('hex');
  const permanent = PDFHexString.of(hashHex);
  pdfDoc.context.trailerInfo.ID = pdfDoc.context.obj([permanent, permanent]);
}

function setStructTreeRoot(pdfDoc: PDFDocument): void {
  const structTreeData = pdfDoc.context.obj({
    Type: PDFName.of('StructTreeRoot'),
  });
  const structTreeRef = pdfDoc.context.register(structTreeData);
  pdfDoc.catalog.set(PDFName.of('StructTreeRoot'), structTreeRef);
}

function setMarkInfo(pdfDoc: PDFDocument): void {
  const markInfo = pdfDoc.context.obj({ Marked: true });
  pdfDoc.catalog.set(PDFName.of('MarkInfo'), markInfo);
}

function fixLinkAnnotations(pdfDoc: PDFDocument): void {
  for (const page of pdfDoc.getPages()) {
    const annotations = page.node.get(PDFName.of('Annots'));
    if (!(annotations instanceof PDFArray)) {
      continue;
    }

    for (let i = 0; i < annotations.size(); i += 1) {
      const annotationRef = annotations.get(i) as PDFRef;
      const annotation = page.node.context.lookup(annotationRef);
      if (!(annotation instanceof PDFDict)) {
        continue;
      }
      const subtype = annotation.get(PDFName.of('Subtype'));
      if (!(subtype instanceof PDFName) || subtype.toString() !== '/Link') {
        continue;
      }

      const flagsObj = annotation.get(PDFName.of('F'));
      const flags = flagsObj instanceof PDFNumber ? flagsObj.asNumber() : 0;
      annotation.set(PDFName.of('F'), PDFNumber.of(flags | 4));
    }
  }
}

function setOutputIntent(pdfDoc: PDFDocument): void {
  const profile = decodeBase64ToBytes(SRGB_ICC_PROFILE_BASE64);
  const profileStream = pdfDoc.context.stream(profile, {
    Length: profile.length,
  });
  const profileStreamRef = pdfDoc.context.register(profileStream);
  const outputIntent = pdfDoc.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB'),
    DestOutputProfile: profileStreamRef,
  });
  const outputIntentRef = pdfDoc.context.register(outputIntent);
  pdfDoc.catalog.set(
    PDFName.of('OutputIntents'),
    pdfDoc.context.obj([outputIntentRef])
  );
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const stripped = base64.replace(/\s+/g, '');
  return new Uint8Array(Buffer.from(stripped, 'base64'));
}

function addMetadata(pdfDoc: PDFDocument, xmp: string): void {
  const metadataStream = pdfDoc.context.stream(xmp, {
    Type: 'Metadata',
    Subtype: 'XML',
    Length: xmp.length,
  });
  const metadataStreamRef = pdfDoc.context.register(metadataStream);
  pdfDoc.catalog.set(PDFName.of('Metadata'), metadataStreamRef);
}

function buildXmpMetadata(meta: XmpMetadataInput): string {
  const escapedSubject = escapeXml(meta.subject);
  const escapedCreator = escapeXml(meta.creator);
  const escapedProducer = escapeXml(meta.producer);
  const escapedAttachment = escapeXml(meta.attachmentName);
  const escapedVersion = escapeXml(meta.zugferdVersion);
  const escapedConformance = escapeXml(meta.conformanceLevel);
  const escapedTimestamp = escapeXml(meta.producedAt);

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" rdf:about="">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" rdf:about="">
      <dc:format>application/pdf</dc:format>
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapedSubject}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:date>
        <rdf:Seq>
          <rdf:li>${escapedTimestamp}</rdf:li>
        </rdf:Seq>
      </dc:date>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${escapedCreator}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapedSubject}</rdf:li>
        </rdf:Alt>
      </dc:description>
    </rdf:Description>
    <rdf:Description xmlns:pdf="http://ns.adobe.com/pdf/1.3/" rdf:about="">
      <pdf:Producer>${escapedProducer}</pdf:Producer>
      <pdf:PDFVersion>1.7</pdf:PDFVersion>
    </rdf:Description>
    <rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" rdf:about="">
      <xmp:CreatorTool>${escapedProducer}</xmp:CreatorTool>
      <xmp:CreateDate>${escapedTimestamp}</xmp:CreateDate>
      <xmp:ModifyDate>${escapedTimestamp}</xmp:ModifyDate>
      <xmp:MetadataDate>${escapedTimestamp}</xmp:MetadataDate>
    </rdf:Description>
    <rdf:Description
      xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
      xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
      xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#"
      rdf:about=""
    >
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The name of the embedded XML document</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The type of the hybrid document in capital letters, e.g. INVOICE or ORDER</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The version of the ZUGFeRD document profile</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The conformance level of the embedded XML document</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
    <rdf:Description xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#" rdf:about="">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${escapedAttachment}</fx:DocumentFileName>
      <fx:Version>${escapedVersion}</fx:Version>
      <fx:ConformanceLevel>${escapedConformance}</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDateWithOffset(date: Date): string {
  const isoWithoutMs = date.toISOString().split('.')[0];
  const offsetMinutes = date.getTimezoneOffset();
  const sign = offsetMinutes <= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(
    2,
    '0'
  );
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  return `${isoWithoutMs}${sign}${hours}:${minutes}`;
}
