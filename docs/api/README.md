# API Documentation

## Overview

This directory contains API documentation for the E-Rechnung application.

## API Routes

### Invoices
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/[invoiceId]` - Get invoice
- `PUT /api/invoices/[invoiceId]` - Update invoice
- `DELETE /api/invoices/[invoiceId]` - Delete invoice

### ZUGFeRD / XRechnung Import
- `GET /api/invoices/import/zugferd` - API metadata and supported formats
- `POST /api/invoices/import/zugferd` - Parse ZUGFeRD/XRechnung files (single or batch); parse-only, no persistence

### Exports
- `GET /api/exports` - List exports for the current organization
- `POST /api/exports` - Create a new export (CSV or DATEV format)
- `GET /api/exports/[exportId]/download` - Download a completed export file

### Uploads
- `POST /api/uploads` - Upload file
- `GET /api/uploads/[uploadId]` - Get upload status

### Stripe
- `POST /api/stripe/checkout` - Create Stripe Checkout session
- `POST /api/stripe/portal` - Create Stripe Customer Portal session
- `POST /api/stripe/webhook` - Stripe webhook handler (signature-verified)

### Health
- `GET /api/health` - Health check endpoint

## ZUGFeRD / XRechnung Import

**GET /api/invoices/import/zugferd**

Returns API metadata and supported formats.

**Response (200):**
```json
{
  "name": "ZUGFeRD/XRechnung Import API",
  "version": "1.0.0",
  "supportedFormats": ["ZUGFeRD 2.3", "XRechnung CII", "XRechnung UBL", "Factur-X"]
}
```

---

**POST /api/invoices/import/zugferd**

Parses one or more ZUGFeRD/XRechnung files. This endpoint is **parse-only** (validate/preview): it does not persist invoices to the database. Use it to validate files or to preview extracted data before committing. Persistence (e.g. a separate “import and save” endpoint or an optional `save=true` query parameter) may be added in a future release.

**Content types:** `multipart/form-data` (file upload) or `application/json`.

**Single file (multipart):** Send one file with form field `file`. Max 10 MB per file.

**Batch (multipart):** Send multiple files with form field `file` (same name, multiple values). Max 50 files per request, 10 MB each.

**Single (JSON):** `{ "xml": "<string>", "format": "pdf" | undefined }`. For PDF, `xml` is base64-encoded PDF content and `format` must be `"pdf"`. For XML, `xml` is the raw XML string and `format` is omitted.

**Batch (JSON):** `{ "invoices": [ { "xml": "<string>", "format": "pdf" | undefined }, ... ] }`. Same rules per item. Max 50 items.

**Success (single, 200):**
```json
{
  "success": true,
  "invoice": { "id": "...", "format": "ZUGFERD", "number": "...", "supplier": {}, "customer": {}, "issueDate": "...", "dueDate": "...", "totals": {} },
  "extendedData": { ... },
  "rawData": { ... },
  "validation": { "valid": true, "errors": [], "warnings": [] },
  "detection": { "flavor": "ZUGFeRD", "version": "2.3" },
  "warnings": []
}
```

**Success (batch, 200 or 207):** When all items succeed → 200. When at least one fails → 207 Multi-Status.
```json
{
  "success": false,
  "batch": true,
  "results": [
    { "success": true, "filename": "inv1.pdf", "invoice": { ... }, "extendedData": { ... }, "validation": { ... }, "detection": { ... }, "errors": [], "warnings": [] },
    { "success": false, "filename": "inv2.xml", "errors": ["..."], "warnings": [], "validation": { ... }, "detection": { ... } }
  ]
}
```

**Error (400):** Missing/invalid body, file too large, too many files, or parse failure (single request).
**Error (500):** Internal server error.

## Exports

**GET /api/exports**

List exports for the current organization. Supports query parameters: `status` (filter by status), `limit` (default 50), `offset` (default 0).

**Response (200):**
```json
{
  "exports": [
    {
      "id": "...",
      "format": "DATEV",
      "filename": "EXTF_1234567_00123_202401151430.csv",
      "status": "READY",
      "storageKey": "exports/.../...",
      "createdAt": "...",
      "invoices": [...],
      "creator": { "id": "...", "name": "...", "email": "..." }
    }
  ]
}
```

---

**POST /api/exports**

Create a new export and generate the file.

**Request body:**
```json
{
  "format": "CSV" | "DATEV",
  "invoiceIds": ["inv-123", "inv-124"],
  "filename": "optional-custom-name.csv",
  "datevOptions": {
    "consultantNumber": "1234567",
    "clientNumber": "00123",
    "fiscalYearStart": "0101",
    "defaultExpenseAccount": "4900",
    "defaultRevenueAccount": "8400",
    "defaultContraAccount": "1200",
    "batchName": "Rechnungen Januar 2024"
  }
}
```

`datevOptions` is only used when `format` is `"DATEV"` and is optional.

**Response (201):**
```json
{
  "export": {
    "id": "...",
    "format": "DATEV",
    "filename": "EXTF_1234567_00123_202401151430.csv",
    "status": "READY",
    "invoiceCount": 2,
    "storageKey": "exports/..."
  }
}
```

---

**GET /api/exports/[exportId]/download**

Download a completed export file. The export must have status `READY`.

**Response (200):** File download with `Content-Disposition: attachment`.

**Error (400):** Export not ready.
**Error (404):** Export not found.

## Authentication

API endpoints require authentication (implementation pending).

## Rate Limiting

Rate limiting is implemented via middleware (configuration pending).
