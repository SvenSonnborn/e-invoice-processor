# E-Invoice Micro-SaaS — Complete Design System (Jan 2026)

**Single Source of Truth (Cursor-Ready)**  
Stack: **Next.js (App Router) + Tailwind CSS + shadcn/ui + lucide-react**

> Goal: a calm, professional, high-trust UI optimized for invoice-heavy workflows (tables, forms, status states) with strong accessibility, consistent tokens, and production-ready component standards.

---

## 0) Design Principles

### Product UX North Stars

1. **Clarity > Cleverness**: Users must understand status, next action, and data correctness instantly.
2. **Trust by Design**: Accounting-adjacent UI should feel stable, predictable, and audit-friendly.
3. **Fast Feedback**: Every async action has a visible state (loading, success, error, retry).
4. **Consistent Semantics**: Colors, typography, and motion communicate meaning, not decoration.
5. **Scalable System**: Tokens + composable components that scale from MVP to multi-team product.

### Visual Tone

- Modern, neutral, slightly technical
- Low-saturation palette, high legibility
- Minimal chrome, generous whitespace
- “Quiet UI”: content/data is the hero

---

## 1) Design Tokens (Foundations)

### 1.1 Color Tokens (Semantic First)

**Philosophy**

- Use semantic tokens in UI (`--color-success`, `--color-border`) rather than raw hex in components.
- Maintain **AA contrast** minimum; target AAA for primary text where possible.
- Status colors should be readable on light backgrounds and remain distinguishable for color-blind users.

#### Core Palette (Hex)

**Neutrals**

- `neutral-0` `#FFFFFF`
- `neutral-50` `#F8FAFC`
- `neutral-100` `#F1F5F9`
- `neutral-200` `#E2E8F0`
- `neutral-300` `#CBD5E1`
- `neutral-400` `#94A3B8`
- `neutral-500` `#64748B`
- `neutral-600` `#475569`
- `neutral-700` `#334155`
- `neutral-800` `#1E293B`
- `neutral-900` `#0F172A`
- `neutral-950` `#020617`

**Brand / Accent (Blue)**

- `brand-50` `#EFF6FF`
- `brand-100` `#DBEAFE`
- `brand-200` `#BFDBFE`
- `brand-300` `#93C5FD`
- `brand-400` `#60A5FA`
- `brand-500` `#3B82F6`
- `brand-600` `#2563EB`
- `brand-700` `#1D4ED8`
- `brand-800` `#1E40AF`
- `brand-900` `#1E3A8A`

**Status**

- Success: `#16A34A` (600), bg `#DCFCE7` (100)
- Warning: `#D97706` (600), bg `#FEF3C7` (100)
- Error: `#DC2626` (600), bg `#FEE2E2` (100)
- Info: `#0284C7` (600), bg `#E0F2FE` (100)

#### Semantic Tokens (Recommended)

Use these tokens throughout the app (via CSS variables / Tailwind config mapping):

**Surface**

- `--bg` = `neutral-50`
- `--surface` = `neutral-0`
- `--surface-2` = `neutral-50`
- `--overlay` = `rgba(2,6,23,0.6)` (neutral-950 @ 60%)

**Text**

- `--text` = `neutral-900`
- `--text-muted` = `neutral-600`
- `--text-subtle` = `neutral-500`
- `--text-disabled` = `neutral-400`
- `--link` = `brand-600`

**Border / Divider**

- `--border` = `neutral-200`
- `--border-strong` = `neutral-300`
- `--ring` = `brand-300`

**Brand**

- `--primary` = `brand-600`
- `--primary-hover` = `brand-700`
- `--primary-active` = `brand-800`
- `--primary-foreground` = `neutral-0`

**States**

- `--success` = `#16A34A`
- `--success-bg` = `#DCFCE7`
- `--warning` = `#D97706`
- `--warning-bg` = `#FEF3C7`
- `--error` = `#DC2626`
- `--error-bg` = `#FEE2E2`
- `--info` = `#0284C7`
- `--info-bg` = `#E0F2FE`

**Focus**

- `--focus` = `brand-300` with 2px outline
- Focus should never rely on color alone; include outline + offset.

---

### 1.2 Typography Tokens

**Font Family**

- Primary: `Inter`
- Fallback: `system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
- Monospace (for XML/IDs): `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`

**Type Scale (Desktop baseline)**

- `display` 36px / 44px — weight 600 — page hero titles
- `h1` 30px / 38px — weight 600 — page titles
- `h2` 24px / 32px — weight 600 — section titles
- `h3` 20px / 28px — weight 600 — card titles
- `body` 16px / 24px — weight 400 — main content
- `body-sm` 14px / 20px — weight 400 — dense UI (tables/forms)
- `caption` 12px / 16px — weight 500 — labels/meta
- `mono-sm` 12–13px / 18px — XML, invoice IDs, hashes

**Rules**

- Default UI density uses `14px` for tables and forms.
- Use `16px` for marketing and docs.
- Numbers: prefer `tabular-nums` for amounts and dates in tables.

---

### 1.3 Spacing & Sizing Tokens

**Grid**

- 4px baseline grid.
- Use Tailwind spacing scale: `1=4px`, `2=8px`, `3=12px`, `4=16px`, `6=24px`, `8=32px`, `12=48px`, `16=64px`.

**Layout**

- Max content width: `1200px` (marketing), `1280px` (app wide screens)
- Sidebar width: `240px` (desktop), collapsible to icon rail
- Topbar height: `56px`
- Card padding: `16–24px`
- Table row height: `44–52px`

---

### 1.4 Radius, Shadows, Borders

**Radius**

- `sm` 6px (inputs, small chips)
- `md` 10px (buttons, cards)
- `lg` 16px (large cards, modals)
- Default in app: **md**

**Shadow**

- Keep subtle; favor borders.
- Card: `0 1px 2px rgba(2,6,23,0.06)`
- Modal: `0 12px 32px rgba(2,6,23,0.18)`

**Border**

- Default 1px `--border`
- Strong 1px `--border-strong` for table headers and split panes

---

## 2) Layout System

### 2.1 Breakpoints

- `sm` 640px
- `md` 768px
- `lg` 1024px
- `xl` 1280px
- `2xl` 1536px

### 2.2 App Shell (Authenticated)

- **Topbar**: org switcher (left), global search (optional), user menu (right)
- **Sidebar**: persistent on desktop; drawer on mobile
- **Main**: content container with page header + content

### 2.3 Page Header Pattern (App)

Every app page should start with:

- Page title (H1)
- Short description (optional, 1 line)
- Primary action button (right side)
- Optional secondary actions (kebab menu or ghost buttons)

---

## 3) Component System (shadcn/ui + Standards)

> Use shadcn/ui as baseline primitives. Extend via variants and composition, not custom one-off components.

### 3.1 Buttons

**Variants**

- `primary` (default): main CTA
- `secondary`: safe actions
- `ghost`: tertiary / toolbar actions
- `destructive`: delete/cancel workflows
- `link`: inline actions

**Sizes**

- `sm` (32px height) — toolbars
- `md` (40px) — default
- `lg` (44px) — primary CTAs / marketing

**Rules**

- Max **one primary** per view.
- Destructive actions require confirm dialog unless fully reversible.
- Always include loading state on async action (`spinner + disabled`).

---

### 3.2 Inputs & Forms

**Components**

- Text input
- Textarea
- Select / Combobox
- Checkbox / Radio
- Switch (for optional settings, not permissions)
- Date picker (only where required)
- File upload dropzone

**Validation**

- Inline, below the field.
- Use concise messages:
  - “Required”
  - “Invalid email”
  - “Must be a PDF or image”
- Do not rely only on red; include icon + text.

**Form Layout**

- Labels above inputs (best for scanning)
- Helper text optional
- Group fields with section dividers

---

### 3.3 Tables (Invoices are Table-First)

**Pattern**

- Sticky header
- Column alignment:
  - text left
  - amounts right
  - status centered or left with badge
- Row click opens detail view (but keep explicit action menu for accessibility)

**Recommended Columns (Invoices)**

- Supplier
- Invoice #
- Date
- Amount
- Status
- Actions (kebab)

**Table Density**

- Default row height 48px.
- Use truncation with tooltip for long supplier names.

---

### 3.4 Status Badges

Statuses:

- `Uploaded`
- `Processing`
- `Validated`
- `Exported`
- `Error`

**Badge Rules**

- Background uses `*-bg` token
- Text uses `*` token
- Always include icon for `Error` and `Warning`

---

### 3.5 Cards

Use for:

- KPI blocks
- Settings sections
- Pricing plans
- Docs previews

**Rules**

- Card title: `h3`
- Body text: `body-sm`
- Avoid nesting cards inside cards unless necessary.

---

### 3.6 Modals / Dialogs

**Use for**

- Confirm delete
- Export confirmation (optional)
- Invite member (future)
- Validation error details (if complex)

**Rules**

- Keep copy short
- One primary, one secondary action
- Esc closes, clicking overlay closes unless destructive

---

### 3.7 Toasts / Notifications

**Toast Types**

- Success: “Export ready.”
- Error: “Upload failed. Try again.”
- Info: “Processing started.”

**Rules**

- Non-blocking
- Provide retry action when applicable
- Do not stack more than 3 visible toasts

---

### 3.8 Empty States

**Pattern**

- Icon (lucide)
- Title (short)
- Description (1–2 lines)
- Primary action button

**Examples**

- Invoices list: “No invoices yet” → “Upload your first invoice”
- Errors filtered list: “No errors found” → “View all invoices”

---

### 3.9 Loading States

**Preferred**

- Skeleton loaders for lists/tables
- Inline spinners for single actions
- Keep layout stable (avoid jump)

**Rules**

- If > 800ms, show skeleton.
- For long processing: show progress status + last updated timestamp.

---

### 3.10 File Upload (Critical Component)

**Dropzone**

- Accept: PDF, JPG, PNG
- Show:
  - supported formats
  - max file size
  - progress bar
  - post-upload status: processing/validated/error
- Offer:
  - remove file (before submit)
  - retry on failure

---

### 3.11 Invoice Detail (Master–Detail)

**Layout**

- Left: file preview (PDF viewer)
- Right: extracted fields + validation + actions
- Tabs:
  - Overview
  - Extracted Data
  - Validation
  - XML (ZUGFeRD/XRechnung)

**Rules**

- Always show a top summary:
  - Supplier, invoice number, date, total, status
- Actions grouped (Export, Download, Reprocess)

---

## 4) Navigation & Information Architecture

### 4.1 Primary Navigation (App)

- Dashboard
- Invoices
- Upload
- Organization
- Settings

### 4.2 Breadcrumbs

Use on:

- Invoice detail pages
- Docs inside app (if present)

---

## 5) Content & Microcopy Guidelines

### 5.1 Tone

- Professional
- Direct
- Helpful
- No sarcasm, no fluff

### 5.2 Error Copy Pattern

Structure:

- What happened
- What to do next
- Optional: reference ID for support

Example:

- “Upload failed. The file is corrupted. Please try a different file.”

### 5.3 Success Copy Pattern

- Short confirmation + next action
- “Invoice processed. Download e-invoice XML.”

---

## 6) Accessibility (Non-Negotiable)

- WCAG 2.2 AA target
- Keyboard navigation for:
  - sidebar
  - tables (row focus + actions)
  - dialogs
  - dropdowns
- Focus visible:
  - 2px outline using `--focus`
  - 2px offset
- Minimum target size: 44px
- Icons never the only indicator (pair with text)

---

## 7) Motion System

**Principles**

- Reduce cognitive load
- Motion supports state change, not decoration

**Timing**

- 150–200ms standard transitions
- 250ms for modals
- Easing: standard “ease-out” feel (avoid bouncy)

**Where Motion is Allowed**

- Button hover/press
- Toast in/out
- Dialog open/close
- Sidebar collapse

**Avoid**

- Continuous animations
- Parallax
- Attention-grabbing motion

---

## 8) Iconography

**Library**

- lucide-react

**Sizes**

- 16px: inline / dense
- 20px: default
- 24px: empty states / callouts

**Rules**

- Consistent stroke width
- Icons support text, do not replace labels

---

## 9) Data Display Standards (Invoices)

### 9.1 Formatting

- Currency: right aligned, use `tabular-nums`
- Dates: consistent format (e.g., `YYYY-MM-DD` in tables, localized in detail)
- IDs: monospace, copy button available

### 9.2 Status Model

- Uploaded → Processing → Validated → Exported
- Error is a parallel state; show “Retry” action

---

## 10) Dark Mode (Optional, Future-Safe)

Design system is optimized for light mode. If dark mode is added:

- Maintain semantic tokens
- Preserve contrast ratios
- Avoid pure black; use neutral-950 as base

---

## 11) Component Inventory (Implementation Checklist)

### Primitives (shadcn/ui)

- Button
- Input
- Textarea
- Select
- Checkbox
- Switch
- Badge
- Card
- Table
- Tabs
- Dialog
- DropdownMenu
- Toast/Sonner
- Separator
- Skeleton

### Product Components (Compose from primitives)

- AppShell (Topbar + Sidebar)
- PageHeader (title + actions)
- InvoiceTable (filters + table)
- InvoiceDetail (tabs + preview)
- UploadDropzone (progress + retry)
- StatusBadge (semantic)
- EmptyState (reusable)
- InlineAlert (info/warn/error)

---

## 12) UI QA Checklist

- All pages have:
  - page title + primary action (if applicable)
  - empty state
  - loading state
  - error state
- All forms:
  - labels
  - validation
  - disabled submit during async
- All destructive actions:
  - confirm dialog
- All tables:
  - keyboard accessible actions
  - readable density
  - clear statuses

---

## 13) Practical Tailwind + shadcn Guidance (Token Use)

**Rules**

- Use semantic classes mapped to tokens (e.g. `bg-background`, `text-foreground`) rather than raw colors.
- Avoid custom hex usage inside components unless defining tokens.
- Keep consistent spacing: use `p-4`, `p-6`, `gap-2`, `gap-4`, `gap-6`.

**Recommended Defaults**

- App background: `neutral-50`
- Card: white with subtle border
- Primary buttons: `brand-600` with hover `brand-700`
- Borders: `neutral-200`
- Focus ring: `brand-300` 2px

---

## 14) Deliverable Summary

This design system provides:

- Foundational tokens (color, type, spacing, radius, shadow)
- App layout rules and navigation patterns
- Component standards and variants (buttons, forms, tables, badges, dialogs, toasts)
- Accessibility and motion rules
- Invoice-specific UI conventions

**Next recommended step (implementation):**

- Create Tailwind theme token mapping (`globals.css` + `tailwind.config.ts`)
- Generate shadcn/ui theme variables matching these tokens
- Build the reusable product components listed in Section 11
