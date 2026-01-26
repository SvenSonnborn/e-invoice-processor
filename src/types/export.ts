export type ExportFormat = "CSV" | "DATEV";

export interface ExportJob {
  id: string;
  format: ExportFormat;
  filename: string;
  createdAt: string;
}

