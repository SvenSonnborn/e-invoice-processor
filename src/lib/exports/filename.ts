const MAX_FILENAME_LENGTH = 120;

type ExportFilenameFormat =
  | 'CSV'
  | 'DATEV'
  | 'XRECHNUNG'
  | 'ZUGFERD'
  | 'xrechnung'
  | 'zugferd';

function getExpectedExtension(format: ExportFilenameFormat): string {
  switch (format) {
    case 'XRECHNUNG':
    case 'xrechnung':
      return 'xml';
    case 'ZUGFERD':
    case 'zugferd':
      return 'pdf';
    case 'DATEV':
    case 'CSV':
    default:
      return 'csv';
  }
}

export function sanitizeExportFilename(
  filename: string,
  format: ExportFilenameFormat
): string {
  const expectedExtension = getExpectedExtension(format);
  const maxBaseLength = MAX_FILENAME_LENGTH - expectedExtension.length - 1;

  const noPathSegments = filename.trim().split(/[\\/]/).pop() ?? filename;
  const withoutControlChars = noPathSegments.replace(/[\u0000-\u001f\u007f]/g, '');
  const withoutLeadingDots = withoutControlChars.replace(/^\.+/, '');
  const normalized = withoutLeadingDots
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const extensionSuffix = `.${expectedExtension}`;
  let base = normalized;

  if (base.toLowerCase().endsWith(extensionSuffix)) {
    base = base.slice(0, -extensionSuffix.length);
  } else if (base.includes('.')) {
    const dotIndex = base.lastIndexOf('.');
    if (dotIndex > 0) {
      base = base.slice(0, dotIndex);
    }
  }

  const safeBase = (base || 'export').slice(0, maxBaseLength);
  return `${safeBase}.${expectedExtension}`;
}

export function buildAttachmentContentDisposition(filename: string): string {
  const fallbackFilename = filename
    .replace(/[\r\n";]/g, '_')
    .replace(/[\\/]/g, '_')
    .replace(/[^\x20-\x7e]/g, '_')
    .trim();
  const safeFallback = fallbackFilename || 'download';
  const encodedFilename = encodeURIComponent(filename)
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)
    .replace(/\*/g, '%2A');

  return `attachment; filename="${safeFallback}"; filename*=UTF-8''${encodedFilename}`;
}
