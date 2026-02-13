'use client';

import { useId, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';

const ONE_MEGABYTE = 1024 * 1024;

export interface InvoiceUploadSuccessResponse {
  success: true;
  file: {
    id: string;
    filename: string;
    contentType: string | null;
    sizeBytes: number;
    storageKey: string;
    status: string;
    createdAt: string;
  };
  invoice: {
    id: string;
    fileId: string | null;
    status: string;
  };
}

interface InvoiceUploadErrorResponse {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

type InvoiceUploadResponse =
  | InvoiceUploadSuccessResponse
  | InvoiceUploadErrorResponse;

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface InvoiceUploadProps {
  className?: string;
  uploadUrl?: string;
  maxFileSizeMb?: number;
  onUploadSuccess?: (
    response: InvoiceUploadSuccessResponse,
    file: File
  ) => void | Promise<void>;
  onUploadError?: (message: string) => void;
}

function formatFileSize(sizeInBytes: number): string {
  if (sizeInBytes < ONE_MEGABYTE) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeInBytes / ONE_MEGABYTE).toFixed(2)} MB`;
}

function isPdfFile(file: File): boolean {
  const isMimePdf = file.type === 'application/pdf';
  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
  return isMimePdf || hasPdfExtension;
}

function resolveUploadErrorMessage(
  response: InvoiceUploadErrorResponse
): string {
  return (
    response.error?.message ??
    response.message ??
    'Upload fehlgeschlagen. Bitte versuchen Sie es erneut.'
  );
}

function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (progress: number) => void
): Promise<InvoiceUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', uploadUrl, true);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(progress);
    };

    xhr.onerror = () => {
      reject(new Error('Netzwerkfehler beim Upload.'));
    };

    xhr.onload = () => {
      let parsedResponse: InvoiceUploadResponse | null = null;

      try {
        parsedResponse = JSON.parse(xhr.responseText) as InvoiceUploadResponse;
      } catch {
        reject(new Error('Unerwartete Antwort vom Server.'));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsedResponse);
        return;
      }

      reject(
        new Error(
          resolveUploadErrorMessage(
            parsedResponse as InvoiceUploadErrorResponse
          )
        )
      );
    };

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

export function InvoiceUpload({
  className,
  uploadUrl = '/api/invoices/upload',
  maxFileSizeMb = 10,
  onUploadSuccess,
  onUploadError,
}: InvoiceUploadProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const maxBytes = maxFileSizeMb * ONE_MEGABYTE;
  const isUploading = status === 'uploading';
  const statusMessageId = `${fileInputId}-status`;
  const hintMessageId = `${fileInputId}-hint`;

  const openFilePicker = () => {
    if (isUploading) {
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    fileInputRef.current?.click();
  };

  const setValidationError = (message: string) => {
    setStatus('error');
    setProgress(0);
    setErrorMessage(message);
    onUploadError?.(message);
  };

  const resetUploadState = () => {
    setStatus('idle');
    setProgress(0);
    setErrorMessage(null);
  };

  const validateFile = (file: File): string | null => {
    if (!isPdfFile(file)) {
      return 'Ungültiger Dateityp. Bitte laden Sie eine PDF-Datei hoch.';
    }

    if (file.size > maxBytes) {
      return `Datei zu groß. Maximal ${maxFileSizeMb} MB erlaubt.`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    setStatus('uploading');
    setErrorMessage(null);
    setProgress(0);

    try {
      const response = await uploadFileWithProgress(
        uploadUrl,
        file,
        (value) => {
          setProgress(value);
        }
      );

      if (!response.success) {
        throw new Error(resolveUploadErrorMessage(response));
      }

      setProgress(100);
      setStatus('success');
      await onUploadSuccess?.(response, file);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Upload fehlgeschlagen. Bitte versuchen Sie es erneut.';
      setValidationError(message);
    }
  };

  const processFile = async (file: File) => {
    const validationError = validateFile(file);

    if (validationError) {
      setSelectedFile(null);
      setValidationError(validationError);
      return;
    }

    setSelectedFile(file);
    resetUploadState();
    await uploadFile(file);
  };

  const handleInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await processFile(file);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isUploading) {
      return;
    }

    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isUploading) {
      return;
    }

    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);

    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isUploading) {
      return;
    }

    dragCounterRef.current = 0;
    setIsDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await processFile(file);
  };

  const handleDropzoneKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFilePicker();
    }
  };

  const handleRemoveFile = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setSelectedFile(null);
    resetUploadState();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className={cn('border border-border shadow-sm', className)}>
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl text-foreground">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          Rechnung hochladen
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Ziehen Sie eine PDF-Datei in die Upload-Zone oder wählen Sie sie
          manuell aus.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Rechnung als PDF hochladen"
          aria-disabled={isUploading}
          aria-describedby={`${hintMessageId} ${statusMessageId}`}
          onClick={openFilePicker}
          onKeyDown={handleDropzoneKeyDown}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'relative flex min-h-56 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 py-10 text-center transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border bg-background hover:border-primary/40 hover:bg-accent/40',
            isUploading && 'cursor-not-allowed opacity-90',
            status === 'error' && 'border-destructive/50 bg-destructive/5'
          )}
        >
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={handleInputChange}
            aria-label="PDF-Datei auswählen"
          />

          <div className="mb-4 rounded-full bg-primary/10 p-3">
            <UploadCloud className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>

          <p className="text-base font-medium text-foreground">
            Ziehen Sie eine PDF hierher
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            oder klicken Sie zum Auswählen
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-5 min-h-11"
            disabled={isUploading}
            onClick={(event) => {
              event.stopPropagation();
              openFilePicker();
            }}
            aria-label="Datei über Dateiauswahl auswählen"
          >
            Datei auswählen
          </Button>

          <p
            id={hintMessageId}
            className="mt-4 text-xs tabular-nums text-muted-foreground"
          >
            Max. {maxFileSizeMb} MB | Nur PDF
          </p>
        </div>

        {selectedFile && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {selectedFile.name}
                </p>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRemoveFile}
                disabled={status === 'uploading'}
                className="min-h-11 self-start sm:self-center"
                aria-label="Datei entfernen"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Entfernen
              </Button>
            </div>

            {status === 'uploading' && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Upload läuft</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Upload-Fortschritt"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div id={statusMessageId} aria-live="polite" className="space-y-2">
          {status === 'success' && selectedFile && (
            <p className="flex items-start gap-2 rounded-md bg-success-bg px-3 py-2 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                Upload erfolgreich.{' '}
                <span className="font-medium">{selectedFile.name}</span> wird
                jetzt verarbeitet.
              </span>
            </p>
          )}

          {errorMessage && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
