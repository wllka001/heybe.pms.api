# Degaanly Backend (Somalia, Production-Ready)

This backend is designed for Somalia operations with multi-building tenancy, strict organization isolation, and manual payment recording.

## Core Decisions

- Country context: Somalia
- Base currency: `USD` only
- Payment methods: `evc`, `merchant`, `bank`
- Payment collection: external/real-world channels only; system records and reconciles manually
- Multi-tenancy: every business record is scoped by `organizationId`
- Security: JWT auth + RBAC + permission checks + organization guard + audit logging

## Payment Model (Manual Ledger)

Payments are never initiated by this API. Staff records confirmed payments with evidence:

- `evc`: reference number and sender/receiver details
- `merchant`: merchant reference + merchant details
- `bank`: bank transaction reference/slip

Lifecycle:

- `recorded`
- `verified`
- `reconciled`
- optional: `rejected`, `reversed`

## Finance Flow

### Invoice Generation

1. Find active leases for the month.
2. Skip if invoice already exists (idempotent).
3. Pull unbilled utility readings.
4. Apply late fee from previous overdue invoice (if any).
5. Build invoice totals in USD.
6. Mark included readings as billed.

### Payment Allocation

1. Record payment manually.
2. Allocate to oldest outstanding invoices first.
3. Update invoice `paidAmount`, `balance`, and `status`.
4. Save payment receipt + lifecycle status.
5. Audit every action.

## Production Features Implemented

- Global request validation
- Global exception filter
- Global response transform
- Security middleware (`helmet`, compression, CORS)
- Environment validation with Joi
- Swagger docs endpoint (`/docs`)
- Health endpoint
- Audit log module and interceptor
- Reporting module with occupancy, arrears, rent roll, cash flow, expenses breakdown

## Main API Prefix

Configured via `API_PREFIX` (default `api/v1`).

Examples:

- `POST /api/v1/auth/login`
- `POST /api/v1/finance/payments`
- `POST /api/v1/finance/invoices/generate`
- `GET /api/v1/reports/occupancy`

## Key Collections

- organizations
- users
- buildings
- units
- tenants
- leases
- invoices
- payments
- utility_readings
- expenses
- maintenance_requests
- vendors
- employees
- payrolls
- audit_logs

## Notes

- Currency is fixed to USD by schema and config.
- Payment methods are constrained to `evc`, `merchant`, `bank`.
- This design is ready for horizontal scaling with stateless API instances and MongoDB replica set transactions.
