import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Building, BuildingDocument } from '@/modules/buildings/schemas/building.schema';
import { Expense, ExpenseDocument } from '@/modules/finance/schemas/expense.schema';
import { ReportQueryDto } from '../dto/report-query.dto';
import { buildDateRange, getBuildingSummary, roundCurrency, toObjectId } from '../report-helpers';

@Injectable()
export class ExpenseReportService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Building.name) private readonly buildingModel: Model<BuildingDocument>,
  ) {}

  async generate(organizationId: string, query: ReportQueryDto) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    const dateRange = buildDateRange(query);
    if (dateRange) {
      filter.expenseDate = { $gte: dateRange.from, $lte: dateRange.to };
    }
    if (query.buildingId) filter.buildingId = toObjectId(query.buildingId);

    const expenses = await this.expenseModel.find(filter).sort({ expenseDate: -1 }).lean();
    const buildingIds = [...new Set(expenses.map((item) => item.buildingId).filter(Boolean).map((item) => String(item)))];
    const buildings = await this.buildingModel.find({ _id: { $in: buildingIds.map((id) => new Types.ObjectId(id)) } }).lean();
    const buildingMap = new Map(buildings.map((item: any) => [String(item._id), item]));

    const details = expenses.map((expense: any) => ({
      _id: String(expense._id),
      expenseNumber: expense.expenseNumber,
      category: expense.category,
      subCategory: expense.subCategory,
      description: expense.description,
      amount: roundCurrency(expense.amount || 0),
      currency: expense.currency || 'USD',
      building: getBuildingSummary(buildingMap.get(String(expense.buildingId))),
      payee: expense.payee,
      expenseDate: expense.expenseDate,
      payment: expense.payment,
      approval: expense.approval,
      createdAt: expense.createdAt,
    }));

    const categoryTotals = details.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = roundCurrency((acc[item.category] || 0) + item.amount);
      return acc;
    }, {});

    return {
      reportName: 'Expense Report',
      summary: {
        totalExpenses: details.length,
        totalExpenseAmount: roundCurrency(details.reduce((sum, item) => sum + item.amount, 0)),
        monthlyExpenseTotal: roundCurrency(details.reduce((sum, item) => sum + item.amount, 0)),
        expenseCategories: Object.entries(categoryTotals).map(([category, amount]) => ({
          category,
          amount,
        })),
      },
      details,
      currency: 'USD',
    };
  }
}
