'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Download, FileCode2, FileText, Loader2 } from 'lucide-react';

type ExportFormat = 'xrechnung' | 'zugferd';

interface InvoiceExportActionsProps {
  invoiceId: string;
  invoiceNumber?: string | null;
}

interface ApiErrorPayload {
  error?: {
    message?: string;
  };
}

const exportMeta: Record<ExportFormat, { label: string; extension: string }> = {
  xrechnung: { label: 'XRechnung', extension: 'xml' },
  zugferd: { label: 'ZUGFeRD', extension: 'pdf' },
};

function parseFilenameFromContentDisposition(
  contentDisposition: string | null
): string | null {
  if (!contentDisposition) return null;

  const utf8FilenameMatch = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i
  );
  if (utf8FilenameMatch?.[1]) {
    try {
      return decodeURIComponent(utf8FilenameMatch[1]);
    } catch {
      return utf8FilenameMatch[1];
    }
  }

  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return filenameMatch?.[1] ?? null;
}

function createDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.error?.message ?? 'Export fehlgeschlagen.';
  } catch {
    return 'Export fehlgeschlagen.';
  }
}

function buildFallbackFilename(
  invoiceId: string,
  invoiceNumber: string | null | undefined,
  format: ExportFormat
) {
  const sanitizedInvoiceNumber = invoiceNumber
    ?.trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-');
  const safePrefix =
    sanitizedInvoiceNumber && sanitizedInvoiceNumber.length > 0
      ? sanitizedInvoiceNumber
      : `invoice-${invoiceId}`;
  return `${safePrefix}.${exportMeta[format].extension}`;
}

export function InvoiceExportActions({
  invoiceId,
  invoiceNumber,
}: InvoiceExportActionsProps) {
  const router = useRouter();
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isExporting = activeFormat !== null;

  const handleExport = async (format: ExportFormat) => {
    setActiveFormat(format);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/export/${encodeURIComponent(invoiceId)}?format=${format}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response));
      }

      const fileBlob = await response.blob();
      if (fileBlob.size === 0) {
        throw new Error('Die Exportdatei ist leer.');
      }

      const fallbackFilename = buildFallbackFilename(
        invoiceId,
        invoiceNumber,
        format
      );
      const filename =
        parseFilenameFromContentDisposition(
          response.headers.get('Content-Disposition')
        ) ?? fallbackFilename;

      createDownload(fileBlob, filename);
      toast.success('Download gestartet', {
        description: `${exportMeta[format].label} wurde erfolgreich erstellt.`,
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Export fehlgeschlagen.';
      setErrorMessage(message);
      toast.error('Export fehlgeschlagen', {
        description: message,
      });
    } finally {
      setActiveFormat(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          onClick={() => void handleExport('xrechnung')}
          disabled={isExporting}
        >
          {activeFormat === 'xrechnung' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileCode2 className="h-4 w-4" />
          )}
          XRechnung XML
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleExport('zugferd')}
          disabled={isExporting}
        >
          {activeFormat === 'zugferd' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          ZUGFeRD PDF
        </Button>
        <Button asChild variant="outline">
          <Link
            href={`/exports?invoiceId=${encodeURIComponent(invoiceId)}&openExport=1`}
          >
            <Download className="h-4 w-4" />
            Weitere Exporte
          </Link>
        </Button>
      </div>
      {errorMessage && (
        <p role="status" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
