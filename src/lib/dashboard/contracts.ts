import type { InvoiceStatus } from '@/src/generated/prisma/client';
import type { ApiInvoiceStatusGroup } from '@/src/lib/invoices/status';
import type { DashboardStatusDistribution } from '@/src/lib/dashboard/invoices';

export interface DashboardInvoiceItem {
  id: string;
  number: string | null;
  supplierName: string | null;
  status: InvoiceStatus;
  statusGroup: ApiInvoiceStatusGroup;
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
  pagination?: {
    limit: number;
    offset: number;
    page: number;
    hasMore: boolean;
  };
  stats: DashboardInvoicesStats;
}

export interface DashboardInvoicesQuery {
  statusGroup?: ApiInvoiceStatusGroup;
  status?: string;
  q?: string;
  search?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  grossAmountMin?: number;
  grossAmountMax?: number;
  limit?: number;
  cursor?: string;
  page?: number;
  offset?: number;
}
