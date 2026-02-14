'use client';

/**
 * Exports Page
 *
 * Full export flow: select invoices, configure export, download results.
 */

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { ExportDialog } from '@/src/components/exports/export-dialog';
import { ExportList } from '@/src/components/exports/export-list';
import { InvoiceSelector } from '@/src/components/exports/invoice-selector';
import {
  fetchExportsAction,
  fetchInvoicesAction,
  type ExportListItem,
  type InvoiceListItem,
} from '@/app/actions/exports';
import { FileDown } from 'lucide-react';

export default function ExportsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedInvoiceId = searchParams.get('invoiceId');
  const shouldOpenExportDialog = searchParams.get('openExport') === '1';
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [exports, setExports] = useState<ExportListItem[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(() =>
    preselectedInvoiceId ? [preselectedInvoiceId] : []
  );
  const [dialogOpen, setDialogOpen] = useState(
    shouldOpenExportDialog && Boolean(preselectedInvoiceId)
  );
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingExports, setLoadingExports] = useState(true);

  const refreshExports = useCallback(async () => {
    setLoadingExports(true);
    const data = await fetchExportsAction();
    setExports(data);
    setLoadingExports(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const [invoiceData, exportData] = await Promise.all([
        fetchInvoicesAction(),
        fetchExportsAction(),
      ]);

      if (preselectedInvoiceId) {
        const invoiceExists = invoiceData.some(
          (invoice) => invoice.id === preselectedInvoiceId
        );
        if (!invoiceExists) {
          setSelectedInvoiceIds([]);
          setDialogOpen(false);
        }
      }

      setInvoices(invoiceData);
      setLoadingInvoices(false);
      setExports(exportData);
      setLoadingExports(false);
    })();
  }, [preselectedInvoiceId]);

  useEffect(() => {
    if (!preselectedInvoiceId && !shouldOpenExportDialog) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete('invoiceId');
    nextSearchParams.delete('openExport');
    const nextQuery = nextSearchParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [
    pathname,
    preselectedInvoiceId,
    router,
    searchParams,
    shouldOpenExportDialog,
  ]);

  const handleExportCreated = () => {
    setSelectedInvoiceIds([]);
    refreshExports();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exporte</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rechnungen als CSV, DATEV, XRechnung XML oder ZUGFeRD PDF/A-3
            exportieren
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          disabled={selectedInvoiceIds.length === 0}
        >
          <FileDown className="h-4 w-4" />
          Neuer Export
          {selectedInvoiceIds.length > 0 && (
            <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
              {selectedInvoiceIds.length}
            </span>
          )}
        </Button>
      </div>

      {/* Invoice Selector */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-900">
            Rechnungen auswählen
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Wählen Sie die Rechnungen aus, die Sie exportieren möchten.
          </p>
        </div>
        <InvoiceSelector
          invoices={invoices}
          selectedIds={selectedInvoiceIds}
          onSelectionChange={setSelectedInvoiceIds}
          loading={loadingInvoices}
        />
      </Card>

      {/* Past Exports */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-900">
            Bisherige Exporte
          </h2>
        </div>
        <ExportList exports={exports} loading={loadingExports} />
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        invoiceIds={selectedInvoiceIds}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onExportCreated={handleExportCreated}
      />
    </div>
  );
}
