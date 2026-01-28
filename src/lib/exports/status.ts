import type { ExportStatus } from '@prisma/client'

/**
 * Export Status Utilities
 *
 * Helper functions for working with export processing states.
 */

/**
 * Valid status transitions
 * Defines which status changes are allowed
 */
export const VALID_EXPORT_STATUS_TRANSITIONS: Record<ExportStatus, ExportStatus[]> = {
  CREATED: ['GENERATING', 'FAILED'],
  GENERATING: ['READY', 'FAILED'],
  READY: ['GENERATING'], // Allow re-generation
  FAILED: ['CREATED'], // Allow retry
}

/**
 * Check if a status transition is valid
 */
export function isValidExportStatusTransition(
  from: ExportStatus,
  to: ExportStatus
): boolean {
  return VALID_EXPORT_STATUS_TRANSITIONS[from].includes(to)
}

/**
 * Get the next expected status in the export pipeline
 */
export function getNextExportStatus(current: ExportStatus): ExportStatus | null {
  const transitions: Record<ExportStatus, ExportStatus | null> = {
    CREATED: 'GENERATING',
    GENERATING: 'READY',
    READY: null, // Terminal state
    FAILED: null, // Terminal state (requires manual retry)
  }
  return transitions[current]
}

/**
 * Check if an export is in a terminal state
 */
export function isTerminalExportStatus(status: ExportStatus): boolean {
  return status === 'READY' || status === 'FAILED'
}

/**
 * Check if an export can be processed
 */
export function canProcessExport(status: ExportStatus): boolean {
  return !isTerminalExportStatus(status) || status === 'FAILED' || status === 'READY'
}

/**
 * Get human-readable status label (German)
 */
export function getExportStatusLabel(status: ExportStatus): string {
  const labels: Record<ExportStatus, string> = {
    CREATED: 'Erstellt',
    GENERATING: 'Wird generiert',
    READY: 'Bereit',
    FAILED: 'Fehlgeschlagen',
  }
  return labels[status]
}

/**
 * Get status color for UI display
 */
export function getExportStatusColor(status: ExportStatus): string {
  const colors: Record<ExportStatus, string> = {
    CREATED: 'gray',
    GENERATING: 'blue',
    READY: 'green',
    FAILED: 'red',
  }
  return colors[status]
}

/**
 * Get status description (German)
 */
export function getExportStatusDescription(status: ExportStatus): string {
  const descriptions: Record<ExportStatus, string> = {
    CREATED: 'Export wurde erstellt, Generierung steht noch aus',
    GENERATING: 'Export wird gerade generiert',
    READY: 'Export wurde erfolgreich erstellt und steht zum Download bereit',
    FAILED: 'Generierung ist fehlgeschlagen',
  }
  return descriptions[status]
}

/**
 * Status badge for UI (Tailwind classes)
 */
export function getExportStatusBadgeClasses(status: ExportStatus): string {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'

  const colorClasses: Record<ExportStatus, string> = {
    CREATED: 'bg-gray-100 text-gray-800',
    GENERATING: 'bg-blue-100 text-blue-800',
    READY: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  }

  return `${baseClasses} ${colorClasses[status]}`
}
