import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Building, BuildingSchema } from '@/modules/buildings/schemas/building.schema';
import { Lease, LeaseSchema } from '@/modules/leases/schemas/lease.schema';
import { Tenant, TenantSchema } from '@/modules/tenants/schemas/tenant.schema';
import { UtilityUsage, UtilityUsageSchema } from '@/modules/utility-usage/schemas/utility-usage.schema';
import { Organization, OrganizationSchema } from '@/modules/organizations/schemas/organization.schema';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  UtilityReading,
  UtilityReadingSchema,
} from './schemas/utility-reading.schema';
import { DepositRefund, DepositRefundSchema } from './schemas/deposit-refund.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: UtilityReading.name, schema: UtilityReadingSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: UtilityUsage.name, schema: UtilityUsageSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: DepositRefund.name, schema: DepositRefundSchema },
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
