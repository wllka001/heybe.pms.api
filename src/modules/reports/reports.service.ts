import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Expense, ExpenseDocument } from '@/modules/finance/schemas/expense.schema';
import { Invoice, InvoiceDocument } from '@/modules/finance/schemas/invoice.schema';
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from '@/modules/maintenance/schemas/maintenance-request.schema';
import { Lease, LeaseDocument } from '@/modules/leases/schemas/lease.schema';
import { Tenant, TenantDocument } from '@/modules/tenants/schemas/tenant.schema';
import { Unit, UnitDocument } from '@/modules/units/schemas/unit.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Unit.name) private readonly unitModel: Model<UnitDocument>,
    @InjectModel(Lease.name) private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(MaintenanceRequest.name)
    private readonly maintenanceModel: Model<MaintenanceRequestDocument>,
  ) {}

  async rentRoll(organizationId: string, buildingId?: string) {
    const match: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      status: 'active',
      deletedAt: null,
    };

    if (buildingId) {
      match.buildingId = new Types.ObjectId(buildingId);
    }

    const leases = await this.leaseModel
      .find(match)
      .populate('tenantId', 'tenantCode personalInfo contact')
      .populate('unitId', 'unitNumber floor type marketRent')
      .lean();

    const totalMonthlyRent = leases.reduce(
      (sum, lease) => sum + Number(lease.terms.rentAmount ?? 0),
      0,
    );

    return {
      totalActiveLeases: leases.length,
      totalMonthlyRent,
      leases,
      currency: 'USD',
    };
  }

  async arrears(organizationId: string, buildingId?: string) {
    const match: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      status: { $in: ['overdue', 'partially_paid', 'pending'] },
      balance: { $gt: 0 },
      deletedAt: null,
    };

    if (buildingId) {
      match.buildingId = new Types.ObjectId(buildingId);
    }

    const invoices = await this.invoiceModel
      .find(match)
      .sort({ 'period.dueDate': 1 })
      .lean();

    const totalArrears = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.balance ?? 0),
      0,
    );

    return {
      totalArrears,
      totalInvoices: invoices.length,
      invoices,
      currency: 'USD',
    };
  }

  async occupancy(organizationId: string, buildingId?: string) {
    const match: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (buildingId) {
      match.buildingId = new Types.ObjectId(buildingId);
    }

    const [totalUnits, occupiedUnits, vacantUnits] = await Promise.all([
      this.unitModel.countDocuments(match),
      this.unitModel.countDocuments({ ...match, status: 'occupied' }),
      this.unitModel.countDocuments({ ...match, status: 'vacant' }),
    ]);

    const occupancyRate = totalUnits === 0 ? 0 : (occupiedUnits / totalUnits) * 100;

    return {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate: Number(occupancyRate.toFixed(2)),
    };
  }

  async incomeExpense(organizationId: string, fromDate?: string, toDate?: string) {
    const matchBase: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (fromDate && toDate) {
      matchBase.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    const [invoiceAgg, expenseAgg] = await Promise.all([
      this.invoiceModel.aggregate([
        { $match: matchBase },
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: '$summary.totalAmount' },
            totalCollected: { $sum: '$paidAmount' },
          },
        },
      ]),
      this.expenseModel.aggregate([
        { $match: matchBase },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const totalInvoiced = Number(invoiceAgg[0]?.totalInvoiced ?? 0);
    const totalCollected = Number(invoiceAgg[0]?.totalCollected ?? 0);
    const totalExpenses = Number(expenseAgg[0]?.totalExpenses ?? 0);

    return {
      totalInvoiced,
      totalCollected,
      totalExpenses,
      netCashflow: totalCollected - totalExpenses,
      currency: 'USD',
    };
  }

  async expensesByCategory(organizationId: string, fromDate?: string, toDate?: string) {
    const match: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (fromDate && toDate) {
      match.expenseDate = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    return this.expenseModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  async maintenanceSummary(organizationId: string) {
    const match = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    const [statusBreakdown, avgCost] = await Promise.all([
      this.maintenanceModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            total: { $sum: 1 },
          },
        },
      ]),
      this.maintenanceModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            averageCost: { $avg: '$cost.actual' },
          },
        },
      ]),
    ]);

    return {
      statusBreakdown,
      averageCost: Number(avgCost[0]?.averageCost ?? 0),
      currency: 'USD',
    };
  }

  async tenantTurnover(organizationId: string) {
    const [activeTenants, inactiveTenants, totalLeases, terminatedLeases] =
      await Promise.all([
        this.tenantModel.countDocuments({
          organizationId: new Types.ObjectId(organizationId),
          status: 'active',
          deletedAt: null,
        }),
        this.tenantModel.countDocuments({
          organizationId: new Types.ObjectId(organizationId),
          status: 'inactive',
          deletedAt: null,
        }),
        this.leaseModel.countDocuments({
          organizationId: new Types.ObjectId(organizationId),
          deletedAt: null,
        }),
        this.leaseModel.countDocuments({
          organizationId: new Types.ObjectId(organizationId),
          status: 'terminated',
          deletedAt: null,
        }),
      ]);

    const turnoverRate = totalLeases === 0 ? 0 : (terminatedLeases / totalLeases) * 100;

    return {
      activeTenants,
      inactiveTenants,
      totalLeases,
      terminatedLeases,
      turnoverRate: Number(turnoverRate.toFixed(2)),
    };
  }

  async cashFlowProjection(organizationId: string) {
    const now = new Date();
    const match = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
      'period.dueDate': {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
        $lte: new Date(now.getFullYear(), now.getMonth() + 3, 0),
      },
    };

    const projections = await this.invoiceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: '$period.year',
            month: '$period.month',
          },
          projectedIncome: { $sum: '$balance' },
          projectedTotal: { $sum: '$summary.totalAmount' },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
        },
      },
    ]);

    return {
      projections,
      currency: 'USD',
    };
  }
}
