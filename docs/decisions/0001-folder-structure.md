# ADR 0001: Folder Structure

## Status
Accepted

## Context
We need to establish a clear, scalable folder structure for the e-invoice processing application that supports:
- Clear separation of concerns
- Easy navigation and discovery
- Scalability as the application grows
- Type safety and code organization

## Decision
We will use a layered architecture with the following structure:

```
src/
├── components/     # React components (ui, layout, domain, common)
├── lib/           # Shared utilities and configuration
├── server/        # Server-side logic (actions, services, repositories)
├── types/         # TypeScript type definitions
└── styles/        # Global styles
```

### Key Principles
1. **Domain-driven organization** for business logic
2. **Separation of concerns** between UI, business logic, and data access
3. **Shared utilities** in `lib/` for cross-cutting concerns
4. **Type safety** with centralized type definitions

## Consequences

### Positive
- Clear organization makes code easy to find
- Separation of concerns improves maintainability
- Scalable structure supports growth
- Type safety improves developer experience

### Negative
- More files and folders to navigate initially
- Requires discipline to maintain structure

## Alternatives Considered
- Flat structure - rejected due to scalability concerns
- Feature-based structure - considered but domain-based structure chosen for better separation
