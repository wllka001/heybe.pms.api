import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Building, BuildingDocument } from '@/modules/buildings/schemas/building.schema';
import { Invoice, InvoiceDocument } from '@/modules/finance/schemas/invoice.schema';
import { Lease, LeaseDocument } from '@/modules/leases/schemas/lease.schema';
import { Tenant, TenantDocument } from '@/modules/tenants/schemas/tenant.schema';
import { Unit, UnitDocument } from '@/modules/units/schemas/unit.schema';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  buildDateRange,
  getBuildingSummary,
  getLeaseSummary,
  getTenantSummary,
  getUnitSummary,
  roundCurrency,
  toObjectId,
} from '../report-helpers';

@Injectable()
export class InvoiceReportService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Lease.name) private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Unit.name) private readonly unitModel: Model<UnitDocument>,
    @InjectModel(Building.name) private readonly buildingModel: Model<BuildingDocument>,
  ) { }

  async generate(organizationId: string, query: ReportQueryDto) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.billingMonth) filter['period.month'] = query.billingMonth;
    if (query.billingYear) filter['period.year'] = query.billingYear;
    if (query.leaseId) filter.leaseId = toObjectId(query.leaseId);
    if (query.tenantId) filter.tenantId = toObjectId(query.tenantId);
    if (query.unitId) filter.unitId = toObjectId(query.unitId);
    if (query.buildingId) filter.buildingId = toObjectId(query.buildingId);

    const dateRange = buildDateRange(query);
    if (dateRange && !query.billingMonth && !query.billingYear) {
      filter.createdAt = { $gte: dateRange.from, $lte: dateRange.to };
    }

    const invoices = await this.invoiceModel.find(filter).sort({ createdAt: -1 }).lean();

    const leaseIds = [...new Set(invoices.map((item) => String(item.leaseId)))].filter((id) => Types.ObjectId.isValid(id));
    const tenantIds = [...new Set(invoices.map((item) => String(item.tenantId)))].filter((id) => Types.ObjectId.isValid(id));
    const unitIds = [...new Set(invoices.map((item) => String(item.unitId)))].filter((id) => Types.ObjectId.isValid(id));
    const buildingIds = [...new Set(invoices.map((item) => String(item.buildingId)))].filter((id) => Types.ObjectId.isValid(id));

    const [leases, tenants, units, buildings] = await Promise.all([
      this.leaseModel.find({ _id: { $in: leaseIds.map((id) => new Types.ObjectId(id)) } }).lean(),
      this.tenantModel.find({ _id: { $in: tenantIds.map((id) => new Types.ObjectId(id)) } }).lean(),
      this.unitModel.find({ _id: { $in: unitIds.map((id) => new Types.ObjectId(id)) } }).lean(),
      this.buildingModel.find({ _id: { $in: buildingIds.map((id) => new Types.ObjectId(id)) } }).lean(),
    ]);

    const leaseMap = new Map(leases.map((item: any) => [String(item._id), item]));
    const tenantMap = new Map(tenants.map((item: any) => [String(item._id), item]));
    const unitMap = new Map(units.map((item: any) => [String(item._id), item]));
    const buildingMap = new Map(buildings.map((item: any) => [String(item._id), item]));

    const details = invoices.map((invoice: any) => ({
      _id: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber,
      lease: getLeaseSummary(leaseMap.get(String(invoice.leaseId))),
      tenant: getTenantSummary(tenantMap.get(String(invoice.tenantId))),
      unit: getUnitSummary(unitMap.get(String(invoice.unitId))),
      building: getBuildingSummary(buildingMap.get(String(invoice.buildingId))),
      period: invoice.period,
      rentAmount: roundCurrency(invoice.items?.rent?.amount || 0),
      utilityAmount: roundCurrency(invoice.summary?.utilitiesSubtotal || 0),
      previousBalance: 0,
      additionalAmount: roundCurrency(invoice.summary?.additionalSubtotal || 0),
      taxTotal: roundCurrency(invoice.summary?.taxTotal || 0),
      totalAmount: roundCurrency(invoice.summary?.totalAmount || 0),
      paidAmount: roundCurrency(invoice.paidAmount || 0),
      balance: roundCurrency(invoice.balance || 0),
      status: invoice.status,
      utilityBreakdown: invoice.items?.utilities || [],
      additionalCharges: invoice.items?.additionalCharges || [],
      paymentHistory: invoice.paymentHistory || [],
      createdAt: invoice.createdAt,
    }));

    return {
      reportName: 'Invoice Report',
      summary: {
        totalInvoicesGenerated: details.length,
        totalRentAmount: roundCurrency(details.reduce((sum, item) => sum + item.rentAmount, 0)),
        totalUtilityAmount: roundCurrency(details.reduce((sum, item) => sum + item.utilityAmount, 0)),
        totalPreviousBalance: 0,
        grandTotalInvoiced: roundCurrency(details.reduce((sum, item) => sum + item.totalAmount, 0)),
        totalPaid: roundCurrency(details.reduce((sum, item) => sum + item.paidAmount, 0)),
        totalOutstanding: roundCurrency(details.reduce((sum, item) => sum + item.balance, 0)),
      },
      details,
      currency: 'USD',
    };
  }
}
