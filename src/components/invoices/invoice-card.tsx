/**
 * Invoice Card Component
 * Individual invoice card display with GoBD compliance badge
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { FileText, Calendar, Building2, Euro } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { GoBDBadge, GoBDBadgeCompact } from './gobd-badge';
import { mapPrismaStatusToGoBD } from '@/src/lib/gobd';
import type { Invoice, InvoiceLineItem } from '@/src/generated/prisma/client';

interface InvoiceCardProps {
  invoice: Invoice & { lineItems?: InvoiceLineItem[] };
  onClick?: () => void;
  className?: string;
  showBadge?: boolean;
  compact?: boolean;
}

export function InvoiceCard({
  invoice,
  onClick,
  className,
  showBadge = true,
  compact = false,
}: InvoiceCardProps) {
  const gobdStatus = mapPrismaStatusToGoBD(invoice.gobdStatus);

  // Parse stored violations if available
  const violations =
    (invoice.gobdViolations as Array<{
      code: string;
      message: string;
      field: string;
      severity: string;
    }>) || [];
  const errors = violations.filter((v) => v.severity === 'error');
  const warnings = violations.filter((v) => v.severity === 'warning');

  const formatCurrency = (amount: unknown) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: invoice.currency || 'EUR',
    }).format(Number(amount));
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return format(new Date(date), 'dd.MM.yyyy', { locale: de });
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm transition-all hover:shadow-md',
          onClick && 'cursor-pointer',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {invoice.number || 'Unbenannt'}
            </p>
            <p className="text-sm text-gray-500">
              {formatDate(invoice.issueDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-900">
            {formatCurrency(invoice.grossAmount)}
          </span>
          {showBadge && gobdStatus && <GoBDBadgeCompact status={gobdStatus} />}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border bg-white shadow-sm transition-all hover:shadow-md',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {invoice.number || 'Unbenannte Rechnung'}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(invoice.issueDate)}</span>
            </div>
          </div>
        </div>
        {showBadge && gobdStatus && (
          <GoBDBadge
            status={gobdStatus}
            violations={errors}
            warnings={warnings}
            showDetails={true}
            size="md"
          />
        )}
      </div>

      {/* Body */}
      <div className="space-y-3 p-4">
        {/* Supplier & Customer */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div>
              <p className="text-xs font-medium text-gray-500">Lieferant</p>
              <p className="text-sm text-gray-900">
                {invoice.supplierName || '-'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div>
              <p className="text-xs font-medium text-gray-500">Kunde</p>
              <p className="text-sm text-gray-900">
                {invoice.customerName || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Amounts */}
        <div className="flex items-center gap-4 rounded-md bg-gray-50 p-3">
          <Euro className="h-4 w-4 text-gray-400" />
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-500">Netto:</span>{' '}
              <span className="font-medium">
                {formatCurrency(invoice.netAmount)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Steuer:</span>{' '}
              <span className="font-medium">
                {formatCurrency(invoice.taxAmount)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Brutto:</span>{' '}
              <span className="font-semibold text-gray-900">
                {formatCurrency(invoice.grossAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Count */}
        {invoice.lineItems && (
          <p className="text-xs text-gray-500">
            {invoice.lineItems.length} Position
            {invoice.lineItems.length !== 1 ? 'en' : ''}
          </p>
        )}
      </div>

      {/* Footer */}
      {invoice.gobdValidatedAt && (
        <div className="border-t bg-gray-50 px-4 py-2">
          <p className="text-xs text-gray-500">
            GoBD-validiert:{' '}
            {format(new Date(invoice.gobdValidatedAt), 'dd.MM.yyyy HH:mm', {
              locale: de,
            })}
          </p>
        </div>
      )}
    </div>
  );
}

export default InvoiceCard;
