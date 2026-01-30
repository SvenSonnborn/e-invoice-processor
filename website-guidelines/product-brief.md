# Product Brief – E-Invoice Micro-SaaS (ZUGFeRD / XRechnung)

## 1. Product Overview

### Working Title

**InvoiceFlow / E-Invoice Hub**  
_(Placeholder name – can be changed later)_

### Short Description

A B2B micro-SaaS for **automated processing of incoming invoices** (PDF, scan, email upload) with a strong focus on:

- Conversion into **structured e-invoice formats**
  - ZUGFeRD
  - XRechnung
- Reliable **data extraction (OCR + parsing)**
- Seamless **export and handoff** to downstream systems

The product positions itself **between invoice receipt and accounting software**.

---

## 2. Problem Statement

Starting **January 1st, 2025**, electronic invoices are mandatory in Germany.

Many freelancers, small businesses, and SMEs:

- receive invoices as PDFs, scans, or emails
- lack automated conversion to compliant e-invoice formats
- suffer from manual data entry and media breaks
- are forced into expensive or overly complex ERP systems

---

## 3. Solution

A **lean, modern, and focused tool** that:

- accepts invoices from multiple sources
- extracts and validates invoice data
- converts invoices into compliant e-invoice formats
- exports structured data for accounting and bookkeeping

**No ERP. No accounting system.  
Just the missing link.**

---

## 4. Target Audience

### Primary Users

- Freelancers & self-employed professionals
- Small and medium-sized businesses (SMEs)
- Small tax advisory firms
- Bookkeeping service providers

### Secondary Users (Future)

- SaaS products with invoicing modules
- ERP integrations
- Platforms and marketplaces

---

## 5. Core Features (MVP Scope)

### 5.1 Invoice Ingestion

**Supported Sources**

- File upload (PDF, JPG, PNG)
- Email forwarding (dedicated inbox per organization – later)
- API (future)

**Processing**

- OCR
- Structured data extraction
- Mandatory field validation

---

### 5.2 E-Invoice Conversion

**Supported Formats**

- ZUGFeRD (EN 16931 compliant)
- XRechnung

**Capabilities**

- Automatic format detection
- Validation status (valid / warning / error)
- Version handling

---

### 5.3 Invoice Management

- Central invoice list (table view)
- Status lifecycle:
  - uploaded
  - processed
  - validated
  - exported
- Metadata:
  - supplier
  - invoice number
  - invoice date
  - gross / net amount
  - tax
  - organization

---

### 5.4 Export & Delivery

- CSV export
- Download options:
  - original PDF
  - structured XML (ZUGFeRD / XRechnung)
- DATEV-like exports (future)
- Webhooks / API (future)

---

## 6. User & Organization Model

### Multi-Tenant Architecture

- One user can belong to **multiple organizations**
- One organization can have **multiple users**
- All data is strictly **organization-scoped**

### Roles (MVP)

- Owner
- Member

### Enforcement

- Supabase Row Level Security (RLS)
- Mandatory `org_id` on all business entities
- Prisma queries always scoped by organization

---

## 7. Technical Foundation

### Frontend

- Next.js (App Router)
- Tailwind CSS
- shadcn/ui
- Mobile-first, responsive design

### Backend

- Supabase
  - Authentication
  - PostgreSQL
  - Storage
  - Row Level Security
- Prisma ORM
- SQL migrations via Supabase SQL Editor

### Development Workflow

- Cursor as primary IDE
- Claude Code for:
  - SQL schemas
  - Prisma models
  - validation logic
  - parsing rules

---

## 8. Product Structure

## A) Landing Page (Public)

### Purpose

- Explain the problem
- Communicate value
- Convert visitors into sign-ups

### Content Sections

1. **Hero**
   - “Receive, understand, and process e-invoices — automatically.”
2. **Problem**
   - Legal requirements
   - Manual workflows
3. **Solution**
   - Upload → Convert → Export
4. **Key Features**
   - ZUGFeRD
   - XRechnung
   - CSV Export
5. **Target Users**
6. **Call-to-Action**
   - Start for free

---

## B) Authentication Area (Login / Register)

### Registration

- Email + password
- Create organization (name)
- User becomes organization owner

### Login

- Email + password
- Session handling via Supabase Auth

### UX Goals

- Minimal
- Fast
- No friction

---

## C) Application (Authenticated)

### Main Navigation

- Dashboard
- Invoices
- Upload
- Organization
- Settings

---

### Dashboard

- Key metrics:
  - number of invoices
  - processing status
- Quick actions:
  - upload invoice
  - switch organization

---

### Invoices

- Table view
- Filters
- Status indicators
- Invoice detail view

---

### Upload

- Drag & drop interface
- Progress indicator
- Clear error handling

---

### Organization

- Member management
- Roles
- Email inbox (future)

---

### Settings

- Export defaults
- Format preferences
- API keys (future)

---

## 9. UX Principles

- Clear empty states with helpful copy
- Loading states for all async operations
- Professional, non-technical error messages
- Mobile-first layouts
- No unexplained domain jargon

---

## 10. Market Positioning

**This product is not:**

- an accounting system
- a bookkeeping tool
- an ERP

**It is:**

> The missing layer between invoice receipt and accounting software.

---

## 11. MVP Success Criteria

- Invoice → compliant e-invoice in under 10 seconds
- Clean, reliable structured data
- Zero media breaks
- Intuitive, modern UI
