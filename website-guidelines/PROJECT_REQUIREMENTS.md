# PROJECT_REQUIREMENTS.md

## E-Invoice Micro-SaaS (ZUGFeRD / XRechnung)

**State of the Art – January 2026**

This document defines the **technical requirements, architecture, infrastructure, and operational standards** for the project.  
It is written to be directly actionable for **implementation, scaling, and long-term maintenance**.

---

## 1. System Goals & Non-Goals

### 1.1 Goals

- Reliable processing of incoming invoices (PDF, scan)
- Conversion to compliant **ZUGFeRD / XRechnung**
- Strong data integrity and auditability
- Multi-tenant SaaS architecture
- Secure by default
- Developer-friendly (Cursor, migrations, reproducibility)

### 1.2 Explicit Non-Goals (MVP)

- Full accounting system
- ERP functionality
- Tax calculation engine
- Payment handling

---

## 2. High-Level Architecture

### 2.1 Architecture Style

- **Modern Web SaaS**
- Frontend-heavy with server-side enforcement
- API-driven backend
- Database-centric integrity model

### 2.2 Architectural Pattern

- **BFF (Backend for Frontend)**
- Clear separation between:
  - UI
  - business logic
  - persistence
- Strong use of database constraints + RLS

### 2.3 Core Components

- Web Client (Next.js)
- API Layer (Next.js Route Handlers)
- Auth & DB (Supabase)
- Object Storage (Supabase Storage)
- Background Processing (Async jobs / queues – phased)
- External libraries for OCR & invoice parsing

---

## 3. Tech Stack

### 3.1 Frontend

**Framework**

- Next.js (App Router, React Server Components)

**Styling**

- Tailwind CSS
- shadcn/ui
- CSS variables for theming

**State Management**

- React Server State (preferred)
- Client state via hooks
- Avoid global client state unless necessary

**Forms**

- React Hook Form
- Zod for validation (shared schemas)

---

### 3.2 Backend / API

**Runtime**

- Node.js (LTS, ≥ 20)

**API Layer**

- Next.js Route Handlers
- REST-style endpoints (JSON)
- Typed contracts via Zod

**ORM**

- Prisma
- Single source of truth for data models

**Database**

- PostgreSQL (Supabase)
- Strict schema-first approach

---

### 3.3 Authentication & Authorization

**Auth Provider**

- Supabase Auth

**Auth Model**

- Email + password (MVP)
- Session-based auth (JWT + refresh)

**Authorization**

- Enforced at **database level**
- Supabase Row Level Security (RLS)
- Organization-scoped access (`org_id` mandatory)

---

### 3.4 Storage

**Provider**

- Supabase Storage

**Usage**

- Original invoice files (PDF, images)
- Generated XML outputs

**Rules**

- Files always associated with:
  - organization
  - invoice
- No public buckets
- Access only via signed URLs

---

## 4. Data Model & Multi-Tenancy

### 4.1 Multi-Tenant Strategy

**Model**

- Shared database
- Strong logical isolation

**Key Rules**

- Every business table contains `org_id`
- No cross-org queries allowed
- RLS policies enforce isolation

**User ↔ Organization**

- Many-to-many via membership table
- Roles per organization

---

### 4.2 Core Entities (Conceptual)

- User
- Organization
- OrganizationMember
- Invoice
- InvoiceFile
- InvoiceData (extracted fields)
- Export
- AuditLog

---

## 5. Database & Schema Requirements

### 5.1 General Rules

- Use UUID v7 or UUID v4
- Timestamps in UTC
- Soft deletes only where necessary
- Explicit foreign keys
- Cascades defined intentionally

### 5.2 Constraints

- NOT NULL where possible
- Check constraints for enums
- Unique constraints for:
  - invoice number per supplier + org (optional)

### 5.3 Enums

- Invoice status
- Export format
- Validation status
- Role

---

## 6. Invoice Processing Pipeline

### 6.1 Pipeline Stages

1. Upload
2. OCR
3. Data extraction
4. Validation
5. Conversion
6. Export

### 6.2 Execution Model (MVP)

- Synchronous processing for small files
- Async-ready architecture (queue abstraction)

### 6.3 Future-Proofing

- Background workers
- Retry logic
- Idempotent jobs
- Dead-letter queue

---

## 7. Validation & Compliance

### 7.1 Validation Layers

- Client-side (UX)
- API-level (Zod)
- Database-level (constraints)
- Format-level (ZUGFeRD / XRechnung schema validation)

### 7.2 Compliance Goals

- EN 16931 conformity
- Deterministic XML output
- Reproducible exports

---

## 8. Error Handling Strategy

### 8.1 Principles

- Errors are explicit
- No silent failures
- User-facing errors are human-readable

### 8.2 Categories

- Validation errors (4xx)
- Auth errors (401 / 403)
- Processing errors (422 / 500)
- Infrastructure errors (500)

### 8.3 Logging

- Structured logs (JSON)
- Correlation IDs per request
- Errors stored in DB for invoice processing

---

## 9. Security Requirements

### 9.1 General

- HTTPS everywhere
- Secure headers
- No secrets in client bundles

### 9.2 Secrets Management

- `.env.local` for local
- Supabase secrets in platform
- Never commit secrets

### 9.3 Access Control

- Least privilege principle
- Service role key only on server
- No direct client DB access without RLS

---

## 10. Performance Requirements

### 10.1 Targets

- TTFB < 300ms (cached)
- Invoice processing < 10s (MVP)
- UI interactions < 100ms perceived

### 10.2 Techniques

- Server Components
- Streaming where appropriate
- Avoid over-fetching
- Pagination for all lists

---

## 11. DevOps & Environments

### 11.1 Environments

- Local
- Preview (per branch)
- Production

### 11.2 CI/CD

- Git-based workflow
- Automated checks:
  - Type check
  - Lint
  - Build
  - Prisma schema validation

### 11.3 Migrations

- SQL-first migrations
- Executed via Supabase SQL Editor
- Prisma schema kept in sync

---

## 12. Observability

### 12.1 Logging

- Request-level logs
- Invoice processing logs
- Error logs

### 12.2 Metrics (Future)

- Invoice volume
- Processing duration
- Error rates

---

## 13. API Design Standards

### 13.1 Conventions

- RESTful endpoints
- Consistent naming
- Predictable responses

### 13.2 Response Shape

```json
{
  "data": {},
  "error": null
}
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid invoice format"
  }
}
```

⸻

## 14. Code Quality & Standards

### 14.1 Type Safety

    •	TypeScript everywhere
    •	No any
    •	Zod schemas shared

### 14.2 Linting & Formatting

    •	ESLint
    •	Prettier
    •	Consistent import ordering

⸻

## 15. Documentation Requirements

Must-Have Docs
• README.md
• PROJECT_REQUIREMENTS.md (this file)
• DATABASE_SCHEMA.md
• API_CONTRACTS.md
• SECURITY.md

⸻

## 16. Scalability Considerations

Horizontal Scaling
• Stateless API
• Externalized storage
• DB connection pooling

Vertical Scaling
• DB indexes
• Query optimization
• Caching (future)

⸻

## 17. Explicit Technical Decisions

    •	PostgreSQL as source of truth
    •	RLS over application-only enforcement
    •	Schema-first design
    •	Async-ready but MVP-synchronous
    •	Minimal dependencies

⸻

## 18. Acceptance Criteria

The system is considered production-ready when:
• Multi-tenancy is enforced at DB level
• Invoice lifecycle is fully traceable
• Errors are visible and actionable
• No data leaks across organizations
• Deployments are reproducible
