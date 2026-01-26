import type { Invoice } from "@/src/types";

function escapeCsvCell(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function invoicesToCsv(invoices: Invoice[]) {
  const header = [
    "id",
    "format",
    "number",
    "supplierName",
    "customerName",
    "issueDate",
    "dueDate",
    "currency",
    "netAmount",
    "taxAmount",
    "grossAmount",
  ];

  const rows = invoices.map((inv) => [
    inv.id,
    inv.format,
    inv.number ?? "",
    inv.supplier?.name ?? "",
    inv.customer?.name ?? "",
    inv.issueDate ?? "",
    inv.dueDate ?? "",
    inv.totals?.currency ?? "EUR",
    inv.totals?.netAmount ?? "",
    inv.totals?.taxAmount ?? "",
    inv.totals?.grossAmount ?? "",
  ]);

  return [
    header.map(escapeCsvCell).join(","),
    ...rows.map((r) => r.map(escapeCsvCell).join(",")),
  ].join("\n");
}

