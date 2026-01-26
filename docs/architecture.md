# Architecture Documentation

## Overview

This document describes the architecture of the E-Rechnung (e-invoice) processing application.

## Folder Structure

The application follows a layered architecture with clear separation of concerns:

- **`src/components/`** - React components organized by domain and purpose
- **`src/lib/`** - Shared utilities and configuration
- **`src/server/`** - Server-side logic (actions, services, repositories)
- **`src/types/`** - TypeScript type definitions
- **`src/styles/`** - Global styles

## Key Components

### Database Layer
- Uses Prisma ORM for database access
- Models defined in `prisma/schema.prisma`
- Database client singleton in `src/lib/db/client.ts`

### Authentication
- Auth helpers in `src/lib/auth/`
- Session management utilities

### Storage
- Storage abstraction in `src/lib/storage/`
- Supports S3, R2, and local storage

### Parsers
- ZUGFeRD parser in `src/server/parsers/zugferd/`
- XRechnung parser in `src/server/parsers/xrechnung/`
- OCR adapter in `src/server/parsers/ocr/`

### Exporters
- CSV exporter in `src/server/exporters/csv/`
- DATEV exporter in `src/server/exporters/datev/`

## Data Flow

1. User uploads invoice file
2. File is stored via storage abstraction
3. Parser extracts invoice data (ZUGFeRD/XRechnung)
4. Data is validated and stored in database
5. User can view, edit, and export invoices

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma)
- **UI**: React, Tailwind CSS, shadcn/ui
- **Validation**: Zod
- **Logging**: Pino
