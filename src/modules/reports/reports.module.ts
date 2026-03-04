import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Expense, ExpenseSchema } from '@/modules/finance/schemas/expense.schema';
import { Invoice, InvoiceSchema } from '@/modules/finance/schemas/invoice.schema';
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from '@/modules/maintenance/schemas/maintenance-request.schema';
import { Lease, LeaseSchema } from '@/modules/leases/schemas/lease.schema';
import { Tenant, TenantSchema } from '@/modules/tenants/schemas/tenant.schema';
import { Unit, UnitSchema } from '@/modules/units/schemas/unit.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
