import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Building, BuildingSchema } from '@/modules/buildings/schemas/building.schema';
import { Expense, ExpenseSchema } from '@/modules/finance/schemas/expense.schema';
import { Invoice, InvoiceSchema } from '@/modules/finance/schemas/invoice.schema';
import { Payment, PaymentSchema } from '@/modules/finance/schemas/payment.schema';
import {
  UtilityReading,
  UtilityReadingSchema,
} from '@/modules/finance/schemas/utility-reading.schema';
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from '@/modules/maintenance/schemas/maintenance-request.schema';
import { Lease, LeaseSchema } from '@/modules/leases/schemas/lease.schema';
import { Tenant, TenantSchema } from '@/modules/tenants/schemas/tenant.schema';
import { Unit, UnitSchema } from '@/modules/units/schemas/unit.schema';
import { ExpenseReportService } from './expense-report/expense-report.service';
import { GeneralFinanceReportService } from './general-finance-report/general-finance-report.service';
import { InvoiceReportService } from './invoice-report/invoice-report.service';
import { PaymentReportService } from './payment-report/payment-report.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { TenantBalanceReportService } from './tenant-balance-report/tenant-balance-report.service';
import { TenantHistoryReportService } from './tenant-history-report/tenant-history-report.service';
import { UtilityBillsReportService } from './utility-bills-report/utility-bills-report.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: UtilityReading.name, schema: UtilityReadingSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    UtilityBillsReportService,
    InvoiceReportService,
    PaymentReportService,
    ExpenseReportService,
    GeneralFinanceReportService,
    TenantBalanceReportService,
    TenantHistoryReportService,
  ],
})
export class ReportsModule {}
