export type ExportFormat = 'CSV' | 'DATEV' | 'XRECHNUNG' | 'ZUGFERD';

export interface ExportJob {
  id: string;
  format: ExportFormat;
  filename: string;
  createdAt: string;
}
