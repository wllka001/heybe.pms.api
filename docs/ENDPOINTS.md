# API Endpoints

Base prefix: `/api/v1`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`

## Organizations
- `POST /organizations`
- `GET /organizations`
- `GET /organizations/:id`
- `PATCH /organizations/:id`
- `DELETE /organizations/:id`

## Buildings
- `POST /buildings`
- `GET /buildings`
- `GET /buildings/:id`
- `PATCH /buildings/:id`
- `DELETE /buildings/:id`
- `GET /buildings/:id/units`
- `GET /buildings/:id/stats`

## Units
- `POST /units`
- `POST /units/bulk`
- `GET /units`
- `GET /units/:id`
- `PATCH /units/:id`
- `PATCH /units/:id/status`
- `DELETE /units/:id`
- `GET /units/:id/lease-history`

## Tenants
- `POST /tenants`
- `GET /tenants`
- `GET /tenants/:id`
- `PATCH /tenants/:id`
- `DELETE /tenants/:id`
- `POST /tenants/:id/documents`
- `GET /tenants/:id/payment-history`
- `GET /tenants/:id/leases`

## Leases
- `POST /leases`
- `GET /leases`
- `GET /leases/active`
- `GET /leases/:id`
- `PATCH /leases/:id`
- `POST /leases/:id/terminate`
- `POST /leases/:id/renew`
- `GET /leases/:id/invoices`

## Maintenance
- `POST /maintenance/requests`
- `GET /maintenance/requests`
- `GET /maintenance/requests/:id`
- `PATCH /maintenance/requests/:id`
- `POST /maintenance/requests/:id/assign`
- `POST /maintenance/requests/:id/status`
- `POST /maintenance/requests/:id/attachments`
- `POST /maintenance/requests/:id/cost`
- `POST /maintenance/requests/:id/complete`
- `POST /maintenance/vendors`
- `GET /maintenance/vendors`
- `GET /maintenance/vendors/:id`
- `PATCH /maintenance/vendors/:id`

## Employees
- `POST /employees`
- `GET /employees`
- `GET /employees/:id`
- `PATCH /employees/:id`
- `DELETE /employees/:id`

## Payroll
- `POST /payroll/generate`
- `GET /payroll`
- `GET /payroll/:id`
- `POST /payroll/:id/approve`
- `POST /payroll/:id/process`
- `POST /payroll/:id/employee/:employeeId`

## Finance
- `POST /finance/invoices/generate`
- `GET /finance/invoices`
- `GET /finance/invoices/:id`
- `GET /finance/invoices/:id/pdf`
- `POST /finance/invoices/:id/reminder`
- `POST /finance/payments`
- `GET /finance/payments`
- `GET /finance/payments/:id`
- `GET /finance/payments/:id/receipt`
- `POST /finance/payments/:id/verify`
- `POST /finance/payments/:id/reconcile`
- `POST /finance/payments/:id/reverse`
- `POST /finance/readings`
- `POST /finance/readings/bulk`
- `GET /finance/readings`
- `GET /finance/readings/unbilled`
- `POST /finance/expenses`
- `GET /finance/expenses`
- `GET /finance/expenses/:id`
- `PATCH /finance/expenses/:id`
- `POST /finance/expenses/:id/approve`
- `POST /finance/reports/summary`

## Reports
- `GET /reports/rent-roll`
- `GET /reports/arrears`
- `GET /reports/occupancy`
- `GET /reports/income-expense`
- `GET /reports/expenses-by-category`
- `GET /reports/maintenance-summary`
- `GET /reports/tenant-turnover`
- `GET /reports/cash-flow`

## Audit
- `GET /audit/logs`

## Health
- `GET /health`
