/**
 * ZUGFeRD 2.3 Parser - Extracts XML from PDF/A-3 attachments
 */

import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFArray,
  PDFStream,
  PDFRef,
  PDFString,
} from 'pdf-lib';

export class ZUGFeRDParserError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ZUGFeRDParserError';
  }
}

/**
 * Extracts embedded XML from a ZUGFeRD PDF/A-3 file
 * ZUGFeRD embeds the XML invoice as an attachment with specific name patterns
 */
export async function extractXMLFromPDF(
  pdfBuffer: Buffer | ArrayBuffer | Uint8Array
): Promise<string> {
  try {
    let buffer: Uint8Array;

    if (Buffer.isBuffer(pdfBuffer)) {
      buffer = new Uint8Array(pdfBuffer);
    } else if (pdfBuffer instanceof ArrayBuffer) {
      buffer = new Uint8Array(pdfBuffer);
    } else if (pdfBuffer instanceof Uint8Array) {
      buffer = pdfBuffer;
    } else {
      throw new ZUGFeRDParserError('Invalid PDF buffer type');
    }

    const pdfDoc = await PDFDocument.load(buffer);

    // Get all embedded files
    const catalog = pdfDoc.catalog;
    const names = catalog.lookup(PDFName.of('Names')) as PDFDict | undefined;

    if (!names) {
      throw new ZUGFeRDParserError('No embedded files found in PDF');
    }

    const embeddedFileNames = names.lookup(PDFName.of('EmbeddedFiles')) as
      | PDFDict
      | undefined;

    if (!embeddedFileNames) {
      throw new ZUGFeRDParserError('No EmbeddedFiles entry found in PDF');
    }

    // Get the names array
    const namesArray = embeddedFileNames.lookup(PDFName.of('Names')) as
      | PDFArray
      | undefined;

    if (!namesArray) {
      // Try Kids array for complex structures
      const kidsArray = embeddedFileNames.lookup(PDFName.of('Kids')) as
        | PDFArray
        | undefined;
      if (!kidsArray) {
        throw new ZUGFeRDParserError('No embedded file names found');
      }
      throw new ZUGFeRDParserError(
        'Complex embedded file structure not yet supported'
      );
    }

    // Look for ZUGFeRD XML file
    const xmlContent = await findZUGFeRDXML(pdfDoc, namesArray);

    if (!xmlContent) {
      throw new ZUGFeRDParserError('No ZUGFeRD XML attachment found in PDF');
    }

    return xmlContent;
  } catch (error) {
    if (error instanceof ZUGFeRDParserError) {
      throw error;
    }
    throw new ZUGFeRDParserError(
      'Failed to extract XML from PDF',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Find ZUGFeRD XML file in embedded files
 */
async function findZUGFeRDXML(
  pdfDoc: PDFDocument,
  namesArray: PDFArray
): Promise<string | null> {
  // ZUGFeRD standard file names
  const zugferdFileNames = [
    'zugferd-invoice.xml',
    'ZUGFeRD-invoice.xml',
    'factur-x.xml',
    'FACTUR-X.xml',
    'factur-x-invoice.xml',
    'FACTUR-X-invoice.xml',
    'xrechnung.xml',
    'XRECHNUNG.xml',
    'order-x.xml',
    'ORDER-X.xml',
  ];

  for (let i = 0; i < namesArray.size(); i += 2) {
    const fileName = namesArray.get(i) as PDFName | PDFString;
    const fileSpecRef = namesArray.get(i + 1) as PDFRef | PDFDict;

    let fileNameStr: string;
    if (fileName instanceof PDFName) {
      fileNameStr = fileName.decodeText();
    } else {
      fileNameStr = fileName.decodeText();
    }

    // Check if this is a ZUGFeRD XML file
    const normalizedName = fileNameStr.toLowerCase();
    const isZUGFeRDFile = zugferdFileNames.some(
      (name) =>
        normalizedName.includes(name.toLowerCase()) ||
        normalizedName.endsWith('.xml')
    );

    if (isZUGFeRDFile || normalizedName.endsWith('.xml')) {
      const fileSpec =
        fileSpecRef instanceof PDFRef
          ? (pdfDoc.context.lookup(fileSpecRef) as PDFDict)
          : fileSpecRef;

      const efDict = fileSpec.lookup(PDFName.of('EF')) as PDFDict | undefined;

      if (efDict) {
        const fStreamRef = efDict.get(PDFName.of('F')) as PDFRef | PDFStream;
        const fStream =
          fStreamRef instanceof PDFRef
            ? (pdfDoc.context.lookup(fStreamRef) as PDFStream)
            : fStreamRef;

        if (fStream) {
          // pdf-lib PDFStream internal API for decompressed content
          const bytes = await (
            fStream as unknown as { getContents(): Uint8Array }
          ).getContents();
          return new TextDecoder('utf-8').decode(bytes);
        }
      }
    }
  }

  return null;
}

/**
 * Check if a buffer is a valid PDF
 */
export function isPDF(buffer: Buffer | ArrayBuffer | Uint8Array): boolean {
  const header = Buffer.isBuffer(buffer)
    ? buffer.slice(0, 5)
    : buffer instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength)))
      : Buffer.from(buffer.slice(0, 5));
  return header.toString() === '%PDF-';
}
