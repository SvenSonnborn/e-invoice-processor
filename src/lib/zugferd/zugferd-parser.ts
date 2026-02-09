/**
 * ZUGFeRD 2.3 Parser - Extracts XML from PDF/A-3 attachments
 */

import { PDFDocument, PDFDict, PDFName, PDFArray, PDFStream, PDFRef, PDFString } from 'pdf-lib';

export class ZUGFeRDParserError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ZUGFeRDParserError';
  }
}

export async function extractXMLFromPDF(pdfBuffer: Buffer | ArrayBuffer | Uint8Array): Promise<string> {
  try {
    let buffer: Uint8Array;
    if (Buffer.isBuffer(pdfBuffer)) buffer = new Uint8Array(pdfBuffer);
    else if (pdfBuffer instanceof ArrayBuffer) buffer = new Uint8Array(pdfBuffer);
    else if (pdfBuffer instanceof Uint8Array) buffer = pdfBuffer;
    else throw new ZUGFeRDParserError('Invalid PDF buffer type');

    const pdfDoc = await PDFDocument.load(buffer);
    const catalog = pdfDoc.catalog;
    const names = catalog.lookup(PDFName.of('Names')) as PDFDict | undefined;
    if (!names) throw new ZUGFeRDParserError('No embedded files found in PDF');

    const embeddedFileNames = names.lookup(PDFName.of('EmbeddedFiles')) as PDFDict | undefined;
    if (!embeddedFileNames) throw new ZUGFeRDParserError('No EmbeddedFiles entry found in PDF');

    const namesArray = embeddedFileNames.lookup(PDFName.of('Names')) as PDFArray | undefined;
    if (!namesArray) throw new ZUGFeRDParserError('No embedded file names found');

    const xmlContent = await findZUGFeRDXML(pdfDoc, namesArray);
    if (!xmlContent) throw new ZUGFeRDParserError('No ZUGFeRD XML attachment found in PDF');
    return xmlContent;
  } catch (error) {
    if (error instanceof ZUGFeRDParserError) throw error;
    throw new ZUGFeRDParserError('Failed to extract XML from PDF', error instanceof Error ? error : undefined);
  }
}

async function findZUGFeRDXML(pdfDoc: PDFDocument, namesArray: PDFArray): Promise<string | null> {
  const zugferdFileNames = ['zugferd-invoice.xml', 'factur-x.xml', 'xrechnung.xml', 'order-x.xml'];
  for (let i = 0; i < namesArray.size(); i += 2) {
    const fileName = namesArray.get(i) as PDFName | PDFString;
    const fileSpecRef = namesArray.get(i + 1) as PDFRef | PDFDict;
    const fileNameStr = fileName instanceof PDFName ? fileName.decodeText() : fileName.decodeText();
    const normalizedName = fileNameStr.toLowerCase();
    if (zugferdFileNames.some(name => normalizedName.includes(name)) || normalizedName.endsWith('.xml')) {
      const fileSpec = fileSpecRef instanceof PDFRef ? pdfDoc.context.lookup(fileSpecRef) as PDFDict : fileSpecRef;
      const efDict = fileSpec.lookup(PDFName.of('EF')) as PDFDict | undefined;
      if (efDict) {
        const fStreamRef = efDict.get(PDFName.of('F')) as PDFRef | PDFStream;
        const fStream = fStreamRef instanceof PDFRef ? pdfDoc.context.lookup(fStreamRef) as PDFStream : fStreamRef;
        if (fStream) { const bytes = await (fStream as unknown as { getBytesAsync(): Promise<Uint8Array> }).getBytesAsync(); return new TextDecoder('utf-8').decode(bytes); }
      }
    }
  }
  return null;
}

export function isPDF(buffer: Buffer | ArrayBuffer | Uint8Array): boolean {
  let header: Uint8Array;
  if (Buffer.isBuffer(buffer)) header = new Uint8Array(buffer.slice(0, 5));
  else if (buffer instanceof ArrayBuffer) header = new Uint8Array(buffer.slice(0, 5));
  else header = buffer.slice(0, 5);
  return new TextDecoder('utf-8').decode(header) === '%PDF-';
}
