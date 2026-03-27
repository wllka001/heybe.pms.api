import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Building, BuildingSchema } from '@/modules/buildings/schemas/building.schema';
import { Lease, LeaseSchema } from '@/modules/leases/schemas/lease.schema';
import { Tenant, TenantSchema } from '@/modules/tenants/schemas/tenant.schema';
import { Unit, UnitSchema } from '@/modules/units/schemas/unit.schema';
import { Expense, ExpenseSchema } from '@/modules/finance/schemas/expense.schema';
import { Invoice, InvoiceSchema } from '@/modules/finance/schemas/invoice.schema';
import { Payment, PaymentSchema } from '@/modules/finance/schemas/payment.schema';
import {
  UtilityReading,
  UtilityReadingSchema,
} from '@/modules/finance/schemas/utility-reading.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: UtilityReading.name, schema: UtilityReadingSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
