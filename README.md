# Apartment Management Backend (NestJS + MongoDB)

Production-ready backend scaffold for apartment/property management in Somalia.

## Business Context

- Country: Somalia
- Currency: USD only
- Payment methods supported for manual recording:
  - `evc`
  - `merchant`
  - `bank`

The system records payments after confirmation; it does not initiate gateway collections.

## Tech Stack

- NestJS 10
- MongoDB + Mongoose
- JWT auth
- Class-validator
- Swagger

## Implemented Modules

- `auth`
- `users`
- `organizations`
- `buildings`
- `units`
- `tenants`
- `leases`
- `maintenance` (requests + vendors)
- `employees`
- `payroll`
- `finance` (invoices, payments, utility readings, expenses)
- `reports`
- `audit`
- `health`

## Key Production Features

- Global validation pipe
- Global exception filter
- Global response transformer
- JWT + role + permission + organization guards
- Audit log interceptor
- Config/env validation
- Swagger docs (`/docs`)

## Run

1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Start dev server: `npm run start:dev`

Optional hardening:
- Set `REGISTRATION_TOKEN` to require a shared token for `POST /auth/register`.

Default API prefix: `api/v1`

Endpoint catalog: `docs/ENDPOINTS.md`
