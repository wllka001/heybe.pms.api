import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lease, LeaseSchema } from '@/modules/leases/schemas/lease.schema';
import { UtilityUsage, UtilityUsageSchema } from '@/modules/utility-usage/schemas/utility-usage.schema';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  UtilityReading,
  UtilityReadingSchema,
} from './schemas/utility-reading.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lease.name, schema: LeaseSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: UtilityReading.name, schema: UtilityReadingSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: UtilityUsage.name, schema: UtilityUsageSchema },
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
