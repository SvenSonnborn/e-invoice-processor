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

#### Invoice API status groups

Several invoice endpoints return both:

- `status` (database enum: `UPLOADED`, `CREATED`, `PARSED`, `VALIDATED`, `FAILED`, `EXPORTED`)
- `statusGroup` (API grouping: `uploaded`, `processing`, `processed`, `failed`, `exported`)

Mapping:

- `UPLOADED`, `CREATED` -> `uploaded`
- `PARSED` -> `processing`
- `VALIDATED` -> `processed`
- `FAILED` -> `failed`
- `EXPORTED` -> `exported`

`GET /api/invoices` supports `statusGroup` filtering with all five values above.

### ZUGFeRD / XRechnung Import

- `GET /api/invoices/import/zugferd` - API metadata and supported formats
- `POST /api/invoices/import/zugferd` - Parse ZUGFeRD/XRechnung files (single or batch); optional persistence with `save=true`

### Exports

- `GET /api/exports` - List exports for the current organization
- `POST /api/exports` - Create a new export (CSV or DATEV format)
- `GET /api/exports/[exportId]/download` - Download a completed export file

### Invoice Upload & Processing

- `POST /api/invoices/upload` - Upload invoice file (auto-triggers OCR)
- `POST /api/process-invoice/[fileId]` - Manually trigger OCR processing for a file

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
  "supportedFormats": [
    "ZUGFeRD 2.3",
    "XRechnung CII",
    "XRechnung UBL",
    "Factur-X"
  ]
}
```

---

**POST /api/invoices/import/zugferd**

Parses one or more ZUGFeRD/XRechnung files. By default the endpoint is parse-only (validate/preview). With query parameter `save=true` (or `save=1`), successful parse results are persisted to the `Invoice` table.

When `save=true`:

- A new invoice is created if no invoice with the same `number` exists in the organization.
- Existing invoice data is updated on re-processing (same `organizationId` + `number`).
- Invoices with `EXPORTED` status keep `EXPORTED`; others are set to `VALIDATED`.

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

When `save=true`, successful responses additionally include:

```json
{
  "persistence": {
    "saved": true,
    "invoiceId": "...",
    "action": "created | updated",
    "status": "VALIDATED | EXPORTED",
    "statusGroup": "processed | exported",
    "number": "..."
  }
}
```

**Success (batch, 200 or 207):** When all items succeed → 200. When at least one fails → 207 Multi-Status.

```json
{
  "success": false,
  "batch": true,
  "results": [
    { "success": true, "filename": "inv1.pdf", "invoice": { ... }, "extendedData": { ... }, "validation": { ... }, "detection": { ... }, "errors": [], "warnings": [], "persistence": { "saved": true, "invoiceId": "...", "action": "created", "status": "VALIDATED", "statusGroup": "processed", "number": "..." } },
    { "success": false, "filename": "inv2.xml", "errors": ["..."], "warnings": [], "validation": { ... }, "detection": { ... } }
  ]
}
```

**Error (400):** Missing/invalid body, invalid `save` query value, file too large, too many files, or parse failure (single request).
**Error (500):** Internal server error.

## Invoice Processing

**POST /api/invoices/upload**

Uploads an invoice file, creates File + Invoice records, and automatically triggers OCR processing in the background.

**Response (201):**

```json
{
  "success": true,
  "file": {
    "id": "...",
    "filename": "invoice.pdf",
    "contentType": "application/pdf",
    "sizeBytes": 125000,
    "storageKey": "invoices/...",
    "status": "PENDING",
    "createdAt": "..."
  },
  "invoice": {
    "id": "...",
    "fileId": "...",
    "status": "UPLOADED",
    "statusGroup": "uploaded"
  }
}
```

OCR runs asynchronously after the response is returned. The invoice status will transition to `VALIDATED` (success) or `FAILED` (error).

---

**POST /api/process-invoice/[fileId]**

Manually triggers OCR processing for an uploaded invoice. Supports initial processing and re-processing if the current status can transition to `PARSED`.

**Response (200):**

```json
{
  "success": true,
  "invoice": {
    "id": "...",
    "status": "VALIDATED",
    "statusGroup": "processed",
    "number": "RE-2024-001",
    "supplierName": "Firma GmbH",
    "customerName": "Kunde AG",
    "issueDate": "2024-01-15T00:00:00.000Z",
    "dueDate": "2024-02-15T00:00:00.000Z",
    "grossAmount": "1190.00",
    "format": "UNKNOWN"
  },
  "ocr": { "confidence": 0.95, "pageCount": 1 }
}
```

**Error (409):** Invalid status transition to `PARSED` or duplicate `invoice number` conflict.
**Error (404):** File or linked invoice not found.
**Error (403):** File belongs to different organization.

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

All API endpoints require authentication via Supabase JWT (cookie-based session), except:

- `GET /api/health` — public health check
- `POST /api/waitlist/join` — public waitlist signup
- `POST /api/stripe/webhook` — Stripe signature verification
- `/auth/callback` — OAuth/email confirmation handler

### Auth helpers

- **`getMyUserOrThrow()`** — Validates session and returns the Prisma `User`. Throws `ApiError(UNAUTHENTICATED, 401)` if no session.
- **`getMyOrganizationIdOrThrow()`** — Same as above, plus resolves the user's active organization (via `active-org-id` cookie with fallback to first membership). Throws `ApiError(NO_ORGANIZATION, 403)` if user has no org.

## Error Format

All API routes return a consistent structured error format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

### Error codes

| Code                         | HTTP Status | Description                          |
| ---------------------------- | ----------- | ------------------------------------ |
| `UNAUTHENTICATED`            | 401         | No valid session                     |
| `NO_ORGANIZATION`            | 403         | User has no organization membership  |
| `ORGANIZATION_LOOKUP_FAILED` | 400         | Organization lookup failed           |
| `VALIDATION_ERROR`           | 400         | Invalid request data                 |
| `NOT_FOUND`                  | 404         | Resource not found                   |
| `FORBIDDEN`                  | 403         | Access denied                        |
| `RATE_LIMIT_EXCEEDED`        | 429         | Rate limit exceeded                  |
| `INTERNAL_ERROR`             | 500         | Internal server error                |
| `DUPLICATE_INVOICE_NUMBER`   | 409         | Invoice number already exists in org |

## Rate Limiting

Rate limiting is implemented for the OCR endpoint via `src/lib/rate-limit/`.
