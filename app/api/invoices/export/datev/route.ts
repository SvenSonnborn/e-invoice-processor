/**
 * DATEV Export API Route
 * POST /api/invoices/export/datev
 *
 * Exports selected invoices to DATEV CSV format
 */

import { NextRequest, NextResponse } from "next/server";
import {
  formatInvoicesForDatev,
  type DatevExportConfig,
  type DatevInvoiceMapping,
  type DatevInvoice,
} from "@/src/lib/export/datev";
import { prisma } from "@/src/lib/db/client";

/**
 * Export request body
 */
interface ExportRequestBody {
  invoiceIds: string[];
  config?: Partial<DatevExportConfig>;
  mapping?: Partial<DatevInvoiceMapping>;
  options?: {
    format?: "standard" | "extended";
    detailed?: boolean;
    filename?: string;
  };
}

/**
 * Convert database invoice to DATEV invoice format
 */
function convertToDatevInvoice(
  invoice: Awaited<ReturnType<typeof prisma.invoice.findUnique>>,
  lineItems: Awaited<ReturnType<typeof prisma.invoiceLineItem.findMany>>
): DatevInvoice | null {
  if (!invoice) return null;

  // Determine if incoming or outgoing based on available data
  // This is a heuristic - you may need to adjust based on your business logic
  const isIncoming = invoice.supplierName !== null && invoice.supplierName !== "";

  return {
    id: invoice.id,
    number: invoice.number || undefined,
    supplierName: invoice.supplierName || undefined,
    customerName: invoice.customerName || undefined,
    issueDate: invoice.issueDate || new Date(),
    dueDate: invoice.dueDate || undefined,
    currency: invoice.currency || "EUR",
    netAmount: Number(invoice.netAmount) || 0,
    taxAmount: Number(invoice.taxAmount) || 0,
    grossAmount: Number(invoice.grossAmount) || 0,
    taxRate: 19, // Default, could be calculated from line items
    isIncoming,
    lineItems: lineItems.map(item => ({
      description: item.description || "",
      netAmount: Number(item.netAmount) || 0,
      taxAmount: Number(item.taxAmount) || 0,
      grossAmount: Number(item.grossAmount) || 0,
      taxRate: Number(item.taxRate) || 19,
    })),
  };
}

/**
 * POST handler - Generate DATEV export
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: ExportRequestBody = await request.json();

    // Validate request
    if (!body.invoiceIds || !Array.isArray(body.invoiceIds) || body.invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "Mindestens eine Rechnungs-ID ist erforderlich" },
        { status: 400 }
      );
    }

    // Fetch invoices from database
    const invoices = await Promise.all(
      body.invoiceIds.map(async (id) => {
        const invoice = await prisma.invoice.findUnique({
          where: { id },
          include: {
            lineItems: true,
          },
        });
        return invoice;
      })
    );

    // Filter out null results and convert
    const validInvoices = invoices
      .filter((inv): inv is NonNullable<typeof inv> => inv !== null)
      .map((inv) => convertToDatevInvoice(inv, inv.lineItems))
      .filter((inv): inv is DatevInvoice => inv !== null);

    if (validInvoices.length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Rechnungen gefunden" },
        { status: 404 }
      );
    }

    // Build export configuration
    const exportConfig: DatevExportConfig = {
      encoding: "UTF-8",
      beraterNummer: body.config?.beraterNummer,
      mandantenNummer: body.config?.mandantenNummer,
      wirtschaftsjahrBeginn: body.config?.wirtschaftsjahrBeginn,
      sachkontenrahmen: body.config?.sachkontenrahmen,
      bezeichnung: body.config?.bezeichnung,
      datumVon: body.config?.datumVon,
      datumBis: body.config?.datumBis,
    };

    // Build mapping configuration
    const mapping: DatevInvoiceMapping = {
      kontoEingangsrechnung: body.mapping?.kontoEingangsrechnung || "4400",
      kontoAusgangsrechnung: body.mapping?.kontoAusgangsrechnung || "1200",
      gegenkontoBank: body.mapping?.gegenkontoBank || "1200",
      steuerschluesselStandard: body.mapping?.steuerschluesselStandard || "9",
      steuerschluesselErmäßigt: body.mapping?.steuerschluesselErmäßigt || "8",
      steuerschluesselSteuerfrei: body.mapping?.steuerschluesselSteuerfrei || "0",
      defaultKostenstelle: body.mapping?.defaultKostenstelle,
      defaultKostenträger: body.mapping?.defaultKostenträger,
    };

    // Generate DATEV export
    const result = formatInvoicesForDatev(validInvoices, {
      format: body.options?.format || "standard",
      detailed: body.options?.detailed || false,
      config: exportConfig,
      mapping,
      filename: body.options?.filename,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Export fehlgeschlagen",
          details: result.errors,
        },
        { status: 422 }
      );
    }

    // Return success response with download info
    return NextResponse.json({
      success: true,
      filename: result.filename,
      entryCount: result.entryCount,
      totalAmount: result.totalAmount,
      invoiceCount: validInvoices.length,
      csv: result.csv, // Include CSV content for immediate download
    });
  } catch (error) {
    console.error("DATEV Export Error:", error);
    return NextResponse.json(
      {
        error: "Interner Serverfehler",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - Get export preview/info
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const invoiceIds = searchParams.getAll("invoiceId");

  if (invoiceIds.length === 0) {
    return NextResponse.json(
      { error: "Mindestens eine Rechnungs-ID ist erforderlich" },
      { status: 400 }
    );
  }

  try {
    // Fetch invoices for preview
    const invoices = await Promise.all(
      invoiceIds.map(async (id) => {
        const invoice = await prisma.invoice.findUnique({
          where: { id },
          include: {
            lineItems: true,
          },
        });
        return invoice;
      })
    );

    const validInvoices = invoices
      .filter((inv): inv is NonNullable<typeof inv> => inv !== null)
      .map((inv) => convertToDatevInvoice(inv, inv.lineItems))
      .filter((inv): inv is DatevInvoice => inv !== null);

    if (validInvoices.length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Rechnungen gefunden" },
        { status: 404 }
      );
    }

    // Calculate preview data
    const { previewExport, getExportSummary } = await import("@/src/lib/export/datev");

    const preview = previewExport(validInvoices);
    const summary = getExportSummary(validInvoices);

    return NextResponse.json({
      preview,
      summary,
    });
  } catch (error) {
    console.error("DATEV Preview Error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
