"use client";

/**
 * Export List Component
 *
 * Displays a list of past exports with status badges and download actions.
 */

import { Button } from "@/src/components/ui/button";
import {
  Download,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  FileX,
} from "lucide-react";
import type { ExportListItem } from "@/app/actions/exports";

interface ExportListProps {
  exports: ExportListItem[];
  loading?: boolean;
}

const statusConfig: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  CREATED: {
    label: "Erstellt",
    icon: Clock,
    className: "bg-gray-100 text-gray-700",
  },
  GENERATING: {
    label: "Wird generiert",
    icon: Loader2,
    className: "bg-blue-50 text-blue-700",
  },
  READY: {
    label: "Bereit",
    icon: CheckCircle2,
    className: "bg-green-50 text-green-700",
  },
  FAILED: {
    label: "Fehlgeschlagen",
    icon: AlertCircle,
    className: "bg-red-50 text-red-700",
  },
};

const formatConfig: Record<string, { label: string; className: string }> = {
  CSV: { label: "CSV", className: "bg-gray-100 text-gray-700" },
  DATEV: { label: "DATEV", className: "bg-indigo-50 text-indigo-700" },
};

const handleDownload = (exportId: string) => {
  window.open(`/api/exports/${exportId}/download`, "_blank");
};

const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const ExportList = ({ exports, loading }: ExportListProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Exporte werden geladen...
      </div>
    );
  }

  if (exports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileX className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Noch keine Exporte vorhanden
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Wählen Sie Rechnungen aus und erstellen Sie einen Export.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-3 font-medium text-muted-foreground">
              Dateiname
            </th>
            <th className="text-left py-3 px-3 font-medium text-muted-foreground">
              Format
            </th>
            <th className="text-left py-3 px-3 font-medium text-muted-foreground">
              Status
            </th>
            <th className="text-right py-3 px-3 font-medium text-muted-foreground">
              Rechnungen
            </th>
            <th className="text-left py-3 px-3 font-medium text-muted-foreground">
              Erstellt von
            </th>
            <th className="text-left py-3 px-3 font-medium text-muted-foreground">
              Erstellt am
            </th>
            <th className="text-right py-3 px-3 font-medium text-muted-foreground">
              Aktionen
            </th>
          </tr>
        </thead>
        <tbody>
          {exports.map((exp) => {
            const status = statusConfig[exp.status] ?? statusConfig.CREATED;
            const formatInfo = formatConfig[exp.format] ?? formatConfig.CSV;
            const StatusIcon = status.icon;

            return (
              <tr
                key={exp.id}
                className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span
                      className="truncate max-w-[200px]"
                      title={exp.filename}
                    >
                      {exp.filename}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${formatInfo.className}`}
                  >
                    {formatInfo.label}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                  >
                    <StatusIcon
                      className={`h-3 w-3 ${exp.status === "GENERATING" ? "animate-spin" : ""}`}
                    />
                    {status.label}
                  </span>
                  {exp.status === "FAILED" && exp.errorMessage && (
                    <p
                      className="text-xs text-red-600 mt-0.5 truncate max-w-[200px]"
                      title={exp.errorMessage}
                    >
                      {exp.errorMessage}
                    </p>
                  )}
                </td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {exp.invoiceCount}
                </td>
                <td className="py-3 px-3 text-muted-foreground">
                  {exp.creatorName ?? "–"}
                </td>
                <td className="py-3 px-3 text-muted-foreground">
                  {formatDate(exp.createdAt)}
                </td>
                <td className="py-3 px-3 text-right">
                  {exp.status === "READY" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(exp.id)}
                      aria-label={`${exp.filename} herunterladen`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="inline-block w-8" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
