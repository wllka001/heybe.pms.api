import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Building, BuildingDocument } from '@/modules/buildings/schemas/building.schema';
import { Lease, LeaseDocument } from '@/modules/leases/schemas/lease.schema';
import { Tenant, TenantDocument } from '@/modules/tenants/schemas/tenant.schema';
import { Unit, UnitDocument } from '@/modules/units/schemas/unit.schema';
import { Expense, ExpenseDocument } from '@/modules/finance/schemas/expense.schema';
import { Invoice, InvoiceDocument } from '@/modules/finance/schemas/invoice.schema';
import { Payment, PaymentDocument } from '@/modules/finance/schemas/payment.schema';
import {
  UtilityReading,
  UtilityReadingDocument,
} from '@/modules/finance/schemas/utility-reading.schema';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Building.name) private readonly buildingModel: Model<BuildingDocument>,
    @InjectModel(Unit.name) private readonly unitModel: Model<UnitDocument>,
    @InjectModel(Lease.name) private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(UtilityReading.name)
    private readonly utilityReadingModel: Model<UtilityReadingDocument>,
  ) {}

  async overview(organizationId: string) {
    const organizationObjectId = new Types.ObjectId(organizationId);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const baseMatch = {
      organizationId: organizationObjectId,
      deletedAt: null,
    };

    const [
      totalBuildings,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      maintenanceUnits,
      activeLeases,
      activeTenants,
      currentMonthInvoiceAgg,
      currentMonthPaymentAgg,
      currentMonthExpenseAgg,
      outstandingAgg,
      invoiceStatusAgg,
      paymentStatusAgg,
      expenseCategoryAgg,
      utilityMonthAgg,
      yearlyInvoiceAgg,
      yearlyPaymentAgg,
      yearlyExpenseAgg,
      recentInvoicesRaw,
      recentPaymentsRaw,
      recentExpensesRaw,
    ] = await Promise.all([
      this.buildingModel.countDocuments({ ...baseMatch, isActive: true }),
      this.unitModel.countDocuments({ ...baseMatch, isActive: true }),
      this.unitModel.countDocuments({ ...baseMatch, isActive: true, status: 'occupied' }),
      this.unitModel.countDocuments({ ...baseMatch, isActive: true, status: 'vacant' }),
      this.unitModel.countDocuments({
        ...baseMatch,
        isActive: true,
        status: 'under_maintenance',
      }),
      this.leaseModel.countDocuments({ ...baseMatch, status: 'active' }),
      this.tenantModel.countDocuments({ ...baseMatch, status: 'active' }),
      this.invoiceModel.aggregate([
        {
          $match: {
            ...baseMatch,
            'period.year': currentYear,
            'period.month': currentMonth,
          },
        },
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: '$summary.totalAmount' },
          },
        },
      ]),
      this.paymentModel.aggregate([
        {
          $match: {
            ...baseMatch,
            'lifecycle.status': 'reconciled',
            paymentDate: { $gte: monthStart, $lte: monthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalCollected: { $sum: '$amount' },
          },
        },
      ]),
      this.expenseModel.aggregate([
        {
          $match: {
            ...baseMatch,
            'approval.status': { $ne: 'rejected' },
            expenseDate: { $gte: monthStart, $lte: monthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: '$amount' },
          },
        },
      ]),
      this.invoiceModel.aggregate([
        {
          $match: {
            ...baseMatch,
            balance: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            outstandingBalance: { $sum: '$balance' },
          },
        },
      ]),
      this.invoiceModel.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$status',
            total: { $sum: 1 },
            amount: { $sum: '$summary.totalAmount' },
          },
        },
      ]),
      this.paymentModel.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$lifecycle.status',
            total: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
      this.expenseModel.aggregate([
        {
          $match: {
            ...baseMatch,
            'approval.status': { $ne: 'rejected' },
          },
        },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 6 },
      ]),
      this.utilityReadingModel.aggregate([
        {
          $match: {
            ...baseMatch,
            'billingPeriod.year': currentYear,
            'billingPeriod.month': currentMonth,
          },
        },
        {
          $group: {
            _id: null,
            totalUtilityBills: { $sum: 1 },
            totalUtilityAmount: { $sum: '$totalAmount' },
          },
        },
      ]),
      this.invoiceModel.aggregate([
        {
          $match: {
            ...baseMatch,
            'period.year': currentYear,
          },
        },
        {
          $group: {
            _id: '$period.month',
            total: { $sum: '$summary.totalAmount' },
          },
        },
      ]),
      this.paymentModel.aggregate([
        {
          $match: {
            ...baseMatch,
            'lifecycle.status': 'reconciled',
            paymentDate: { $gte: yearStart, $lte: yearEnd },
          },
        },
        {
          $group: {
            _id: { $month: '$paymentDate' },
            total: { $sum: '$amount' },
          },
        },
      ]),
      this.expenseModel.aggregate([
        {
          $match: {
            ...baseMatch,
            'approval.status': { $ne: 'rejected' },
            expenseDate: { $gte: yearStart, $lte: yearEnd },
          },
        },
        {
          $group: {
            _id: { $month: '$expenseDate' },
            total: { $sum: '$amount' },
          },
        },
      ]),
      this.invoiceModel
        .find(baseMatch)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('tenantId', 'personalInfo tenantCode contact')
        .populate('unitId', 'code unitNumber')
        .lean(),
      this.paymentModel
        .find(baseMatch)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('tenantId', 'personalInfo tenantCode contact')
        .populate('invoiceId', 'invoiceNumber')
        .lean(),
      this.expenseModel.find(baseMatch).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const occupancyRate = totalUnits > 0 ? Number(((occupiedUnits / totalUnits) * 100).toFixed(2)) : 0;
    const currentMonthInvoiced = Number(currentMonthInvoiceAgg[0]?.totalInvoiced ?? 0);
    const currentMonthCollected = Number(currentMonthPaymentAgg[0]?.totalCollected ?? 0);
    const currentMonthExpenses = Number(currentMonthExpenseAgg[0]?.totalExpenses ?? 0);
    const outstandingBalance = Number(outstandingAgg[0]?.outstandingBalance ?? 0);
    const utilityBillsRecorded = Number(utilityMonthAgg[0]?.totalUtilityBills ?? 0);
    const currentMonthUtilityAmount = Number(utilityMonthAgg[0]?.totalUtilityAmount ?? 0);

    const invoiceStatusMap = this.toStatusMap(invoiceStatusAgg);
    const paymentStatusMap = this.toStatusMap(paymentStatusAgg);
    const currentYearMonthly = this.buildMonthlySeries(
      yearlyInvoiceAgg,
      yearlyPaymentAgg,
      yearlyExpenseAgg,
    );

    return {
      generatedAt: new Date().toISOString(),
      currentYear,
      currentMonth,
      summary: {
        totalBuildings,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        maintenanceUnits,
        occupancyRate,
        activeLeases,
        activeTenants,
      },
      finance: {
        currentMonth: {
          invoiced: currentMonthInvoiced,
          collected: currentMonthCollected,
          expenses: currentMonthExpenses,
          outstanding: outstandingBalance,
          utilityBillsRecorded,
          utilityAmount: currentMonthUtilityAmount,
          net: currentMonthCollected - currentMonthExpenses,
        },
        currentYearMonthly,
      },
      invoices: {
        byStatus: invoiceStatusMap,
      },
      payments: {
        byStatus: paymentStatusMap,
      },
      expenses: {
        byCategory: expenseCategoryAgg.map((item) => ({
          category: item._id || 'other',
          total: Number(item.total || 0),
          count: Number(item.count || 0),
        })),
      },
      recent: {
        invoices: recentInvoicesRaw.map((invoice: any) => ({
          id: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          tenantName: this.getTenantName(invoice.tenantId),
          unitCode: this.getUnitCode(invoice.unitId),
          totalAmount: Number(invoice.summary?.totalAmount ?? 0),
          balance: Number(invoice.balance ?? 0),
          status: invoice.status,
          dueDate: invoice.period?.dueDate,
          createdAt: invoice.createdAt,
        })),
        payments: recentPaymentsRaw.map((payment: any) => ({
          id: String(payment._id),
          paymentNumber: payment.paymentNumber,
          invoiceNumber: payment.invoiceId?.invoiceNumber || '-',
          tenantName: this.getTenantName(payment.tenantId),
          amount: Number(payment.amount ?? 0),
          status: payment.lifecycle?.status || 'recorded',
          paymentDate: payment.paymentDate,
          createdAt: payment.createdAt,
        })),
        expenses: recentExpensesRaw.map((expense: any) => ({
          id: String(expense._id),
          expenseNumber: expense.expenseNumber,
          category: expense.category,
          description: expense.description,
          amount: Number(expense.amount ?? 0),
          status: expense.approval?.status || 'pending',
          expenseDate: expense.expenseDate,
          createdAt: expense.createdAt,
        })),
      },
    };
  }

  private buildMonthlySeries(
    invoiceAgg: Array<{ _id: number; total: number }>,
    paymentAgg: Array<{ _id: number; total: number }>,
    expenseAgg: Array<{ _id: number; total: number }>,
  ) {
    const invoiceMap = new Map(invoiceAgg.map((item) => [Number(item._id), Number(item.total || 0)]));
    const paymentMap = new Map(paymentAgg.map((item) => [Number(item._id), Number(item.total || 0)]));
    const expenseMap = new Map(expenseAgg.map((item) => [Number(item._id), Number(item.total || 0)]));

    return MONTH_LABELS.map((label, index) => {
      const month = index + 1;
      const invoiced = invoiceMap.get(month) || 0;
      const collected = paymentMap.get(month) || 0;
      const expenses = expenseMap.get(month) || 0;

      return {
        month,
        label,
        invoiced,
        collected,
        expenses,
        net: collected - expenses,
      };
    });
  }

  private toStatusMap(items: Array<{ _id: string; total: number; amount?: number }>) {
    return items.reduce(
      (acc, item) => {
        const key = item._id || 'unknown';
        acc[key] = {
          count: Number(item.total || 0),
          amount: Number(item.amount || 0),
        };
        return acc;
      },
      {} as Record<string, { count: number; amount: number }>,
    );
  }

  private getTenantName(tenant: any) {
    const firstName = tenant?.personalInfo?.firstName || '';
    const lastName = tenant?.personalInfo?.lastName || '';
    return `${firstName} ${lastName}`.trim() || tenant?.tenantCode || '-';
  }

  private getUnitCode(unit: any) {
    return unit?.code || unit?.unitNumber || '-';
  }
}
