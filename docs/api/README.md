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
- `GET /api/exports` - List exports
- `POST /api/exports` - Create export

### Uploads
- `POST /api/uploads` - Upload file
- `GET /api/uploads/[uploadId]` - Get upload status

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

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

## Authentication

API endpoints require authentication (implementation pending).

## Rate Limiting

Rate limiting is implemented via middleware (configuration pending).
