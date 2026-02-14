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

### Static Assets

- **`public/`** - Static files (SVGs, images, etc.) served by Next.js from the root URL
- **`public/assets/`** - App images (logos, illustrations, favicon). Use root-relative paths e.g. `/assets/logo-icon.png` in pages via `next/image` or `<img>`

## Key Components

### Database Layer

- Uses Prisma ORM (v7) for database access
- Models and relations defined in `prisma/schema.prisma`
- Prisma configuration in `prisma.config.ts`:
  - `DIRECT_URL` is used by the Prisma CLI and migrations
  - `DATABASE_URL` is used at runtime via the Prisma Postgres adapter
- Generated Prisma client output lives at `src/generated/prisma` and is imported from `@/src/generated/prisma/client`
- Database client singleton in `src/lib/db/client.ts`:
  - Uses `@prisma/adapter-pg` (`PrismaPg`) with the Supabase `DATABASE_URL` connection string
  - Exposes a single global `prisma` instance shared across API routes, server actions, and server components

### Authentication

- **Supabase Auth** with JWT access tokens + refresh tokens stored in HTTP cookies
- **`@supabase/ssr`** manages cookie-based sessions for server-side rendering
- Three Supabase client types:
  - **Server client** (`src/lib/supabase/server.ts`) — Server Components, Server Actions, Route Handlers
  - **Browser client** (`src/lib/supabase/client.ts`) — Client Components
  - **Admin client** (`src/lib/supabase/admin.ts`) — Service role for backend tasks (storage, RLS bypass)

#### Middleware (`middleware.ts`)

- Runs on **all** requests (pages + API routes), except static assets
- Refreshes expired JWTs automatically via `supabase.auth.getUser()`
- Redirects unauthenticated users to `/login` for protected page routes (`/dashboard`, `/invoices`, `/exports`, `/settings`)
- Passes `redirectTo` query param so login can redirect back after auth

#### Session helpers (`src/lib/auth/session.ts`)

- `getSession()` — validates JWT server-side via `getUser()`, returns user or null
- `requireAuth()` — for Server Components/Actions, redirects to `/login` if unauthenticated
- `getCurrentUser()` — returns the Prisma `User` record linked by `supabaseUserId`
- `getMyUserOrThrow()` — for API Route Handlers, returns authenticated `User` or throws `ApiError(UNAUTHENTICATED)`
- `getMyOrganizationIdOrThrow()` — returns `{ user, organizationId }` or throws `ApiError`. Respects `active-org-id` cookie, falls back to first membership. Throws `NO_ORGANIZATION` if user has no memberships

#### Standardized API error responses (`src/lib/errors/api-error.ts`)

All API routes use a consistent structured error format:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED | NO_ORGANIZATION | VALIDATION_ERROR | NOT_FOUND | FORBIDDEN | RATE_LIMIT_EXCEEDED | INTERNAL_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

The `ApiError` class provides static factory methods (`ApiError.unauthenticated()`, `ApiError.noOrganization()`, etc.) and a `toResponse()` method that returns the appropriate `NextResponse`.

#### Protected API routes

All API routes require authentication except:

- `/api/health` — public health check
- `/api/waitlist/join` — public waitlist signup
- `/api/stripe/webhook` — uses Stripe signature verification
- `/auth/callback` — OAuth/email confirmation handler

### Storage

- Storage abstraction in `src/lib/storage/`
- Supports S3, R2, and local storage

### Parsers

- ZUGFeRD/XRechnung parser (CII & UBL) in `src/lib/zugferd/`
- OCR adapter in `src/server/parsers/ocr/`

### OCR Service

- Production: `OcrService` — Google Cloud Vision API (`src/server/services/ocr/service.ts`)
- Development: `MockOcrService` — JSON-based mock responses (`src/server/services/ocr/mock-service.ts`)
- Both implement `IOcrService` interface, switched via `OCR_MOCK_ENABLED=true` env var
- Mock fixtures in `mocks/ocr-responses/` (3 German invoice samples)

### Exporters

- CSV exporter in `src/server/exporters/csv/`
- DATEV exporter in `src/server/exporters/datev/`

### Generators

- XRechnung CII generator in `src/lib/generators/xrechnungGenerator.ts`
  (based on `@e-invoice-eu/core`)
- Offline CII/EN16931 XSD files for generator validation in
  `src/lib/generators/schemas/xrechnung/`

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
