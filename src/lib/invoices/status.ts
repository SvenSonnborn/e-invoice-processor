import type { InvoiceStatus } from '@/src/generated/prisma/client';

/**
 * Invoice Status Utilities
 *
 * Helper functions for working with invoice processing states.
 */

/**
 * Valid status transitions
 * Defines which status changes are allowed
 */
export const VALID_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> =
  {
    UPLOADED: ['PARSED', 'FAILED'],
    CREATED: ['PARSED', 'FAILED'],
    PARSED: ['PARSED', 'VALIDATED', 'FAILED'], // Allow re-parse
    VALIDATED: ['PARSED', 'EXPORTED', 'FAILED'], // Allow re-processing
    EXPORTED: ['PARSED', 'VALIDATED', 'FAILED'], // Allow re-processing
    FAILED: ['UPLOADED', 'CREATED', 'PARSED'], // Allow direct re-processing
  };

export const API_INVOICE_STATUS_GROUPS = [
  'uploaded',
  'processing',
  'processed',
  'failed',
  'exported',
] as const;

export type ApiInvoiceStatusGroup = (typeof API_INVOICE_STATUS_GROUPS)[number];

export const API_STATUS_GROUP_TO_INVOICE_STATUSES: Record<
  ApiInvoiceStatusGroup,
  readonly InvoiceStatus[]
> = {
  uploaded: ['UPLOADED', 'CREATED'],
  processing: ['PARSED'],
  processed: ['VALIDATED'],
  failed: ['FAILED'],
  exported: ['EXPORTED'],
};

export function isApiInvoiceStatusGroup(
  value: string | null | undefined
): value is ApiInvoiceStatusGroup {
  if (!value) return false;
  return API_INVOICE_STATUS_GROUPS.includes(value as ApiInvoiceStatusGroup);
}

export function getInvoiceStatusesForApiStatusGroup(
  group: ApiInvoiceStatusGroup | null | undefined
): readonly InvoiceStatus[] | undefined {
  if (!group) return undefined;
  return API_STATUS_GROUP_TO_INVOICE_STATUSES[group];
}

export function mapInvoiceStatusToApiStatusGroup(
  status: InvoiceStatus
): ApiInvoiceStatusGroup {
  if (status === 'UPLOADED' || status === 'CREATED') return 'uploaded';
  if (status === 'PARSED') return 'processing';
  if (status === 'VALIDATED') return 'processed';
  if (status === 'FAILED') return 'failed';
  return 'exported';
}

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: InvoiceStatus,
  to: InvoiceStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Get the next expected status in the processing pipeline
 */
export function getNextStatus(current: InvoiceStatus): InvoiceStatus | null {
  const transitions: Record<InvoiceStatus, InvoiceStatus | null> = {
    UPLOADED: 'PARSED',
    CREATED: 'PARSED',
    PARSED: 'VALIDATED',
    VALIDATED: 'EXPORTED',
    EXPORTED: null, // Terminal state
    FAILED: null, // Terminal state (requires manual retry)
  };
  return transitions[current];
}

/**
 * Check if an invoice is in a terminal state
 */
export function isTerminalStatus(status: InvoiceStatus): boolean {
  return status === 'EXPORTED' || status === 'FAILED';
}

/**
 * Check if an invoice can be processed
 */
export function canProcess(status: InvoiceStatus): boolean {
  return (
    !isTerminalStatus(status) || status === 'FAILED' || status === 'EXPORTED'
  );
}

/**
 * Get human-readable status label (German)
 */
export function getStatusLabel(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    UPLOADED: 'Hochgeladen',
    CREATED: 'Erstellt',
    PARSED: 'Ausgelesen',
    VALIDATED: 'Validiert',
    EXPORTED: 'Exportiert',
    FAILED: 'Fehlgeschlagen',
  };
  return labels[status];
}

/**
 * Get status color for UI display
 */
export function getStatusColor(status: InvoiceStatus): string {
  const colors: Record<InvoiceStatus, string> = {
    UPLOADED: 'gray',
    CREATED: 'gray',
    PARSED: 'blue',
    VALIDATED: 'green',
    EXPORTED: 'green',
    FAILED: 'red',
  };
  return colors[status];
}

/**
 * Get status description (German)
 */
export function getStatusDescription(status: InvoiceStatus): string {
  const descriptions: Record<InvoiceStatus, string> = {
    UPLOADED: 'Datei wurde hochgeladen, Verarbeitung steht noch aus',
    CREATED: 'Rechnung wurde erstellt, Verarbeitung steht noch aus',
    PARSED: 'Rohdaten wurden erfolgreich aus der Datei extrahiert',
    VALIDATED: 'Rechnungsdaten wurden fachlich validiert',
    EXPORTED: 'Rechnung wurde erfolgreich exportiert',
    FAILED: 'Verarbeitung ist fehlgeschlagen',
  };
  return descriptions[status];
}

/**
 * Status badge for UI (Tailwind classes)
 */
export function getStatusBadgeClasses(status: InvoiceStatus): string {
  const baseClasses =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  const colorClasses: Record<InvoiceStatus, string> = {
    UPLOADED: 'bg-gray-100 text-gray-800',
    CREATED: 'bg-gray-100 text-gray-800',
    PARSED: 'bg-blue-100 text-blue-800',
    VALIDATED: 'bg-green-100 text-green-800',
    EXPORTED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  };

  return `${baseClasses} ${colorClasses[status]}`;
}
