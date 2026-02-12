/**
 * DATEV Export Dialog Component
 * UI for configuring and executing DATEV exports
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Download, FileText, Loader2 } from 'lucide-react';

interface DatevExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceIds: string[];
  invoiceCount: number;
  onExportComplete?: () => void;
}

interface ExportConfig {
  beraterNummer: string;
  mandantenNummer: string;
  bezeichnung: string;
  format: 'standard' | 'extended';
  detailed: boolean;
}

export function DatevExportDialog({
  open,
  onOpenChange,
  invoiceIds,
  invoiceCount,
  onExportComplete,
}: DatevExportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ExportConfig>({
    beraterNummer: '',
    mandantenNummer: '',
    bezeichnung: 'Buchungsstapel Export',
    format: 'standard',
    detailed: false,
  });

  const handleExport = async () => {
    if (invoiceIds.length === 0) {
      setError('Keine Rechnungen ausgewählt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/invoices/export/datev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceIds,
          config: {
            beraterNummer: config.beraterNummer || undefined,
            mandantenNummer: config.mandantenNummer || undefined,
            bezeichnung: config.bezeichnung,
          },
          options: {
            format: config.format,
            detailed: config.detailed,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export fehlgeschlagen');
      }

      const result = await response.json();

      if (result.success && result.csv) {
        // Create download
        const blob = new Blob([result.csv], {
          type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        onExportComplete?.();
        onOpenChange(false);
      } else {
        throw new Error('Ungültige Antwort vom Server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            DATEV Export
          </DialogTitle>
          <DialogDescription>
            Exportieren Sie {invoiceCount} Rechnung(en) im DATEV CSV-Format.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="beraterNummer">Beraternummer</Label>
              <Input
                id="beraterNummer"
                placeholder="z.B. 12345678"
                value={config.beraterNummer}
                onChange={(e) =>
                  setConfig({ ...config, beraterNummer: e.target.value })
                }
                maxLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mandantenNummer">Mandantennummer</Label>
              <Input
                id="mandantenNummer"
                placeholder="z.B. 00123"
                value={config.mandantenNummer}
                onChange={(e) =>
                  setConfig({ ...config, mandantenNummer: e.target.value })
                }
                maxLength={5}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bezeichnung">Bezeichnung</Label>
            <Input
              id="bezeichnung"
              placeholder="Buchungsstapel Export"
              value={config.bezeichnung}
              onChange={(e) =>
                setConfig({ ...config, bezeichnung: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Exportformat</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value="standard"
                  checked={config.format === 'standard'}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      format: e.target.value as 'standard',
                    })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">Standard</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value="extended"
                  checked={config.format === 'extended'}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      format: e.target.value as 'extended',
                    })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">Erweitert (EXTF)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="detailed"
              checked={config.detailed}
              onCheckedChange={(checked) =>
                setConfig({ ...config, detailed: checked as boolean })
              }
            />
            <Label
              htmlFor="detailed"
              className="text-sm font-normal cursor-pointer"
            >
              Detaillierter Export (einzelne Positionen)
            </Label>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">Export-Informationen:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{invoiceCount} Rechnung(en) werden exportiert</li>
              <li>Format: DATEV CSV mit UTF-8 BOM</li>
              <li>Kompatibel mit DATEV Unternehmen Online</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || invoiceIds.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportiere...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportieren
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
