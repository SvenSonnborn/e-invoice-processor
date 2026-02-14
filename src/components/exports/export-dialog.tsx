'use client';

/**
 * Export Dialog
 *
 * Dialog for creating an export with format selection and DATEV configuration options.
 */

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Separator } from '@/src/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { createExportAction } from '@/app/actions/exports';
import { validateDatevOptions } from '@/src/server/exporters/datev';
import { Loader2, FileDown } from 'lucide-react';

interface ExportDialogProps {
  invoiceIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportCreated?: () => void;
}

export const ExportDialog = ({
  invoiceIds,
  open,
  onOpenChange,
  onExportCreated,
}: ExportDialogProps) => {
  const [format, setFormat] = useState<
    'CSV' | 'DATEV' | 'XRECHNUNG' | 'ZUGFERD'
  >('DATEV');
  const [isPending, startTransition] = useTransition();
  const requiresSingleInvoice = format === 'XRECHNUNG' || format === 'ZUGFERD';

  // DATEV options state
  const [consultantNumber, setConsultantNumber] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [fiscalYearStart, setFiscalYearStart] = useState('0101');
  const [defaultExpenseAccount, setDefaultExpenseAccount] = useState('4900');
  const [defaultRevenueAccount, setDefaultRevenueAccount] = useState('8400');
  const [defaultContraAccount, setDefaultContraAccount] = useState('1200');
  const [batchName, setBatchName] = useState('');

  const handleSubmit = () => {
    if (requiresSingleInvoice && invoiceIds.length !== 1) {
      toast.error('Ungültige Auswahl', {
        description:
          'Für XRechnung und ZUGFeRD muss genau eine Rechnung ausgewählt sein.',
      });
      return;
    }

    // Client-side validation for DATEV options
    if (format === 'DATEV') {
      const datevOpts = {
        ...(consultantNumber && { consultantNumber }),
        ...(clientNumber && { clientNumber }),
        ...(fiscalYearStart && { fiscalYearStart }),
      };

      const errors = validateDatevOptions(datevOpts);
      if (errors.length > 0) {
        toast.error('Validierungsfehler', {
          description: errors.join(', '),
        });
        return;
      }
    }

    startTransition(async () => {
      const datevOptions =
        format === 'DATEV'
          ? {
              ...(consultantNumber && { consultantNumber }),
              ...(clientNumber && { clientNumber }),
              ...(fiscalYearStart && { fiscalYearStart }),
              defaultExpenseAccount,
              defaultRevenueAccount,
              defaultContraAccount,
              ...(batchName && { batchName }),
            }
          : undefined;

      const result = await createExportAction({
        format,
        invoiceIds,
        datevOptions,
      });

      if (result.success) {
        toast.success('Export erstellt', {
          description: `${result.export.filename} (${result.export.invoiceCount} Rechnungen)`,
          action: {
            label: 'Herunterladen',
            onClick: () => {
              window.open(
                `/api/exports/${result.export.id}/download`,
                '_blank'
              );
            },
          },
        });
        onOpenChange(false);
        onExportCreated?.();
      } else {
        toast.error('Export fehlgeschlagen', {
          description: result.error,
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Neuer Export
          </DialogTitle>
          <DialogDescription>
            {invoiceIds.length} Rechnung{invoiceIds.length !== 1 ? 'en' : ''}{' '}
            exportieren
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="export-format">Format</Label>
            <Select
              value={format}
              onValueChange={(val) =>
                setFormat(val as 'CSV' | 'DATEV' | 'XRECHNUNG' | 'ZUGFERD')
              }
            >
              <SelectTrigger id="export-format">
                <SelectValue placeholder="Format wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CSV">CSV (Standard)</SelectItem>
                <SelectItem value="DATEV">DATEV Buchungsstapel</SelectItem>
                <SelectItem value="XRECHNUNG">XRechnung XML</SelectItem>
                <SelectItem value="ZUGFERD">ZUGFeRD PDF/A-3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {requiresSingleInvoice && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Für dieses Format wird genau eine Rechnung pro Export unterstützt.
            </div>
          )}

          {/* DATEV Configuration Options */}
          {format === 'DATEV' && (
            <>
              <Separator />
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">
                  DATEV Konfiguration
                </p>

                {/* Consultant & Client Numbers */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="consultant-number">Beraternummer</Label>
                    <Input
                      id="consultant-number"
                      placeholder="1234567"
                      value={consultantNumber}
                      onChange={(e) => setConsultantNumber(e.target.value)}
                      maxLength={7}
                    />
                    <p className="text-xs text-muted-foreground">5-7 Ziffern</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="client-number">Mandantennummer</Label>
                    <Input
                      id="client-number"
                      placeholder="00123"
                      value={clientNumber}
                      onChange={(e) => setClientNumber(e.target.value)}
                      maxLength={5}
                    />
                    <p className="text-xs text-muted-foreground">1-5 Ziffern</p>
                  </div>
                </div>

                {/* Fiscal Year Start */}
                <div className="space-y-1.5">
                  <Label htmlFor="fiscal-year-start">WJ-Beginn</Label>
                  <Input
                    id="fiscal-year-start"
                    placeholder="0101"
                    value={fiscalYearStart}
                    onChange={(e) => setFiscalYearStart(e.target.value)}
                    maxLength={4}
                    className="w-24"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: TTMM (z.B. 0101 für 1. Januar)
                  </p>
                </div>

                <Separator />

                {/* Account Numbers */}
                <p className="text-sm font-medium text-foreground">
                  Kontenrahmen
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expense-account">Aufwandkonto</Label>
                    <Input
                      id="expense-account"
                      placeholder="4900"
                      value={defaultExpenseAccount}
                      onChange={(e) => setDefaultExpenseAccount(e.target.value)}
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="revenue-account">Ertragskonto</Label>
                    <Input
                      id="revenue-account"
                      placeholder="8400"
                      value={defaultRevenueAccount}
                      onChange={(e) => setDefaultRevenueAccount(e.target.value)}
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contra-account">Gegenkonto</Label>
                    <Input
                      id="contra-account"
                      placeholder="1200"
                      value={defaultContraAccount}
                      onChange={(e) => setDefaultContraAccount(e.target.value)}
                      maxLength={4}
                    />
                  </div>
                </div>

                {/* Batch Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="batch-name">
                    Buchungsstapel-Bezeichnung{' '}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="batch-name"
                    placeholder="Rechnungen Januar 2024"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending || (requiresSingleInvoice && invoiceIds.length !== 1)
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Wird erstellt...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Exportieren
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
