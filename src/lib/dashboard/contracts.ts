import type { InvoiceStatus } from '@/src/generated/prisma/client';
import type {
  DashboardStatusDistribution,
  DashboardStatusGroup,
} from '@/src/lib/dashboard/invoices';

export interface DashboardInvoiceItem {
  id: string;
  number: string | null;
  supplierName: string | null;
  status: InvoiceStatus;
  grossAmount: number | null;
  createdAt: string;
  issueDate: string | null;
}

export interface DashboardInvoicesStats {
  totalCount: number;
  currentMonthCount: number;
  totalGrossAmount: number;
  statusDistribution: DashboardStatusDistribution;
}

export interface DashboardInvoicesResponse {
  success: true;
  items: DashboardInvoiceItem[];
  nextCursor: string | null;
  stats: DashboardInvoicesStats;
}

export interface DashboardInvoicesQuery {
  statusGroup?: DashboardStatusGroup;
  q?: string;
  limit?: number;
  cursor?: string;
}
