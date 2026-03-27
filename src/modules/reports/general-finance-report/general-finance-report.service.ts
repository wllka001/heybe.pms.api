import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Expense, ExpenseDocument } from '@/modules/finance/schemas/expense.schema';
import { Payment, PaymentDocument } from '@/modules/finance/schemas/payment.schema';
import { ReportQueryDto } from '../dto/report-query.dto';
import { buildDateRange, roundCurrency, toObjectId } from '../report-helpers';

@Injectable()
export class GeneralFinanceReportService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
  ) {}

  async generate(organizationId: string, query: ReportQueryDto) {
    const paymentFilter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
      'lifecycle.status': 'reconciled',
    };
    const expenseFilter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    const dateRange = buildDateRange(query);
    if (dateRange) {
      paymentFilter.paymentDate = { $gte: dateRange.from, $lte: dateRange.to };
      expenseFilter.expenseDate = { $gte: dateRange.from, $lte: dateRange.to };
    }
    if (query.buildingId) {
      const buildingId = toObjectId(query.buildingId);
      paymentFilter.buildingId = buildingId;
      expenseFilter.buildingId = buildingId;
    }

    const [payments, expenses] = await Promise.all([
      this.paymentModel.find(paymentFilter).sort({ paymentDate: -1 }).lean(),
      this.expenseModel.find(expenseFilter).sort({ expenseDate: -1 }).lean(),
    ]);

    const incomeDetails = payments.map((payment: any) => ({
      type: 'income',
      reference: payment.paymentNumber,
      amount: roundCurrency(payment.amount || 0),
      status: payment.lifecycle?.status,
      periodDate: payment.paymentDate,
      notes: payment.notes || payment.lifecycle?.notes || null,
    }));
    const expenseDetails = expenses.map((expense: any) => ({
      type: 'expense',
      reference: expense.expenseNumber,
      amount: roundCurrency(expense.amount || 0),
      category: expense.category,
      periodDate: expense.expenseDate,
      payee: expense.payee?.name || null,
      notes: expense.description || null,
    }));

    const totalIncome = roundCurrency(incomeDetails.reduce((sum, item) => sum + item.amount, 0));
    const totalExpenses = roundCurrency(expenseDetails.reduce((sum, item) => sum + item.amount, 0));

    return {
      reportName: 'General Finance Report',
      summary: {
        totalIncome,
        totalExpenses,
        netProfitOrLoss: roundCurrency(totalIncome - totalExpenses),
      },
      details: {
        income: incomeDetails,
        expenses: expenseDetails,
        period: dateRange,
      },
      currency: 'USD',
    };
  }
}
