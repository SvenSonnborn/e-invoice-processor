'use client';

/**
 * Invoice Selector
 *
 * Lightweight component for selecting invoices to export.
 * Shows a list with checkboxes, invoice number, supplier, amount, and date.
 */

import { Checkbox } from '@/src/components/ui/checkbox';
import { FileText, Loader2 } from 'lucide-react';
import type { InvoiceListItem } from '@/app/actions/exports';

interface InvoiceSelectorProps {
  invoices: InvoiceListItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  loading?: boolean;
}

const formatCurrency = (
  amount: number | null,
  currency: string | null
): string => {
  if (amount === null) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency ?? 'EUR',
  }).format(amount);
};

const formatDate = (isoString: string | null): string => {
  if (!isoString) return '–';
  return new Date(isoString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const InvoiceSelector = ({
  invoices,
  selectedIds,
  onSelectionChange,
  loading,
}: InvoiceSelectorProps) => {
  const allSelected =
    invoices.length > 0 && selectedIds.length === invoices.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const handleToggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(invoices.map((inv) => inv.id));
    }
  };

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Rechnungen werden geladen...
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Keine Rechnungen vorhanden
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Laden Sie zuerst Rechnungen hoch, um Exporte erstellen zu können.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Select All */}
      <div className="flex items-center justify-between py-2 px-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={allSelected}
            ref={(el) => {
              if (el) {
                (el as unknown as HTMLInputElement).indeterminate =
                  someSelected;
              }
            }}
            onCheckedChange={handleToggleAll}
            aria-label="Alle Rechnungen auswählen"
          />
          <label
            htmlFor="select-all"
            className="text-sm font-medium text-muted-foreground cursor-pointer"
          >
            {selectedIds.length > 0
              ? `${selectedIds.length} von ${invoices.length} ausgewählt`
              : 'Alle auswählen'}
          </label>
        </div>
      </div>

      {/* Invoice Rows */}
      <div className="max-h-[320px] overflow-y-auto">
        {invoices.map((invoice) => {
          const isSelected = selectedIds.includes(invoice.id);
          const displayName =
            invoice.supplierName ?? invoice.customerName ?? 'Unbekannt';

          return (
            <label
              key={invoice.id}
              className={`flex items-center gap-3 py-2.5 px-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                isSelected ? 'bg-blue-50/50' : ''
              }`}
              htmlFor={`invoice-${invoice.id}`}
            >
              <Checkbox
                id={`invoice-${invoice.id}`}
                checked={isSelected}
                onCheckedChange={() => handleToggle(invoice.id)}
                aria-label={`${invoice.number ?? 'Rechnung'} auswählen`}
              />
              <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {invoice.number ?? 'Ohne Nummer'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {displayName}
                  </p>
                </div>
                <span className="text-sm tabular-nums text-right whitespace-nowrap">
                  {formatCurrency(invoice.grossAmount, invoice.currency)}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap w-20 text-right">
                  {formatDate(invoice.issueDate)}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
