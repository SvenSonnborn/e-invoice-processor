import type { InvoiceStatus } from '@/src/generated/prisma/client';

export const DASHBOARD_STATUS_GROUPS = [
  'uploaded',
  'processed',
  'exported',
] as const;

export type DashboardStatusGroup = (typeof DASHBOARD_STATUS_GROUPS)[number];

export const DASHBOARD_STATUS_GROUP_LABELS: Record<
  DashboardStatusGroup,
  string
> = {
  uploaded: 'Eingegangen',
  processed: 'Verarbeitet',
  exported: 'Exportiert',
};

export const DASHBOARD_STATUS_GROUP_TO_INVOICE_STATUS: Record<
  DashboardStatusGroup,
  readonly InvoiceStatus[]
> = {
  uploaded: ['UPLOADED', 'CREATED'],
  processed: ['PARSED', 'VALIDATED'],
  exported: ['EXPORTED'],
};

export interface DashboardStatusDistribution {
  uploaded: number;
  processed: number;
  exported: number;
}

export interface InvoiceStatusCountRow {
  status: InvoiceStatus;
  _count: {
    _all: number;
  };
}

export function isDashboardStatusGroup(
  value: string | null | undefined
): value is DashboardStatusGroup {
  if (!value) return false;
  return DASHBOARD_STATUS_GROUPS.includes(value as DashboardStatusGroup);
}

export function getInvoiceStatusesForDashboardGroup(
  group: DashboardStatusGroup | null | undefined
): readonly InvoiceStatus[] | undefined {
  if (!group) return undefined;
  return DASHBOARD_STATUS_GROUP_TO_INVOICE_STATUS[group];
}

export function mapInvoiceStatusToDashboardGroup(
  status: InvoiceStatus
): DashboardStatusGroup | null {
  if (status === 'UPLOADED' || status === 'CREATED') return 'uploaded';
  if (status === 'PARSED' || status === 'VALIDATED') return 'processed';
  if (status === 'EXPORTED') return 'exported';
  return null;
}

export function emptyDashboardStatusDistribution(): DashboardStatusDistribution {
  return {
    uploaded: 0,
    processed: 0,
    exported: 0,
  };
}

export function aggregateDashboardStatusDistribution(
  rows: readonly InvoiceStatusCountRow[]
): DashboardStatusDistribution {
  const distribution = emptyDashboardStatusDistribution();

  for (const row of rows) {
    const group = mapInvoiceStatusToDashboardGroup(row.status);
    if (!group) continue;
    distribution[group] += row._count._all;
  }

  return distribution;
}

export function startOfCurrentMonthInServerTimezone(
  referenceDate: Date = new Date()
): Date {
  // Explicitly use UTC boundary for deterministic server-side month aggregation.
  return new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      1,
      0,
      0,
      0,
      0
    )
  );
}

export function coerceGrossAmountToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    const maybeDecimal = value as { toNumber?: () => number };
    if (typeof maybeDecimal.toNumber === 'function') {
      const parsed = maybeDecimal.toNumber();
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  return 0;
}
