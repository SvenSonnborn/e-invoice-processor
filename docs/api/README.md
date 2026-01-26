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

## Authentication

API endpoints require authentication (implementation pending).

## Rate Limiting

Rate limiting is implemented via middleware (configuration pending).
