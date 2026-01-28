import type { InvoiceStatus } from '@prisma/client'

/**
 * Invoice Status Utilities
 *
 * Helper functions for working with invoice processing states.
 */

/**
 * Valid status transitions
 * Defines which status changes are allowed
 */
export const VALID_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  CREATED: ['PARSED', 'FAILED'],
  PARSED: ['VALIDATED', 'FAILED'],
  VALIDATED: ['EXPORTED', 'FAILED'],
  EXPORTED: ['VALIDATED', 'FAILED'], // Allow re-processing
  FAILED: ['CREATED'], // Allow retry from beginning
}

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: InvoiceStatus,
  to: InvoiceStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[from].includes(to)
}

/**
 * Get the next expected status in the processing pipeline
 */
export function getNextStatus(current: InvoiceStatus): InvoiceStatus | null {
  const transitions: Record<InvoiceStatus, InvoiceStatus | null> = {
    CREATED: 'PARSED',
    PARSED: 'VALIDATED',
    VALIDATED: 'EXPORTED',
    EXPORTED: null, // Terminal state
    FAILED: null, // Terminal state (requires manual retry)
  }
  return transitions[current]
}

/**
 * Check if an invoice is in a terminal state
 */
export function isTerminalStatus(status: InvoiceStatus): boolean {
  return status === 'EXPORTED' || status === 'FAILED'
}

/**
 * Check if an invoice can be processed
 */
export function canProcess(status: InvoiceStatus): boolean {
  return !isTerminalStatus(status) || status === 'FAILED' || status === 'EXPORTED'
}

/**
 * Get human-readable status label (German)
 */
export function getStatusLabel(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    CREATED: 'Erstellt',
    PARSED: 'Ausgelesen',
    VALIDATED: 'Validiert',
    EXPORTED: 'Exportiert',
    FAILED: 'Fehlgeschlagen',
  }
  return labels[status]
}

/**
 * Get status color for UI display
 */
export function getStatusColor(status: InvoiceStatus): string {
  const colors: Record<InvoiceStatus, string> = {
    CREATED: 'gray',
    PARSED: 'blue',
    VALIDATED: 'green',
    EXPORTED: 'green',
    FAILED: 'red',
  }
  return colors[status]
}

/**
 * Get status description (German)
 */
export function getStatusDescription(status: InvoiceStatus): string {
  const descriptions: Record<InvoiceStatus, string> = {
    CREATED: 'Rechnung wurde erstellt, Verarbeitung steht noch aus',
    PARSED: 'Rohdaten wurden erfolgreich aus der Datei extrahiert',
    VALIDATED: 'Rechnungsdaten wurden fachlich validiert',
    EXPORTED: 'Rechnung wurde erfolgreich exportiert',
    FAILED: 'Verarbeitung ist fehlgeschlagen',
  }
  return descriptions[status]
}

/**
 * Status badge for UI (Tailwind classes)
 */
export function getStatusBadgeClasses(status: InvoiceStatus): string {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'

  const colorClasses: Record<InvoiceStatus, string> = {
    CREATED: 'bg-gray-100 text-gray-800',
    PARSED: 'bg-blue-100 text-blue-800',
    VALIDATED: 'bg-green-100 text-green-800',
    EXPORTED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  }

  return `${baseClasses} ${colorClasses[status]}`
}
