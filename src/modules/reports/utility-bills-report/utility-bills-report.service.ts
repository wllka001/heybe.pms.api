import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Building, BuildingDocument } from '@/modules/buildings/schemas/building.schema';
import { UtilityReading, UtilityReadingDocument } from '@/modules/finance/schemas/utility-reading.schema';
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
export class UtilityBillsReportService {
  constructor(
    @InjectModel(UtilityReading.name)
    private readonly utilityReadingModel: Model<UtilityReadingDocument>,
    @InjectModel(Lease.name) private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Unit.name) private readonly unitModel: Model<UnitDocument>,
    @InjectModel(Building.name) private readonly buildingModel: Model<BuildingDocument>,
  ) {}

  async generate(organizationId: string, query: ReportQueryDto) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.billingMonth) filter['billingPeriod.month'] = query.billingMonth;
    if (query.billingYear) filter['billingPeriod.year'] = query.billingYear;
    if (query.leaseId) filter.leaseId = toObjectId(query.leaseId);
    if (query.unitId) filter.unitId = toObjectId(query.unitId);
    if (query.buildingId) filter.buildingId = toObjectId(query.buildingId);

    const dateRange = buildDateRange(query);
    if (dateRange && !query.billingMonth && !query.billingYear) {
      filter.createdAt = { $gte: dateRange.from, $lte: dateRange.to };
    }

    const readings = await this.utilityReadingModel
      .find(filter)
      .sort({ 'billingPeriod.year': -1, 'billingPeriod.month': -1, createdAt: -1 })
      .lean();

    const leaseIds = [...new Set(readings.map((item) => String(item.leaseId)))];
    const tenantIds: string[] = [];
    const unitIds = [...new Set(readings.map((item) => String(item.unitId)))];
    const buildingIds = [...new Set(readings.map((item) => String(item.buildingId)))];

    const leases = await this.leaseModel
      .find({ _id: { $in: leaseIds.map((id) => new Types.ObjectId(id)) } })
      .populate('tenantId')
      .lean();
    leases.forEach((lease: any) => {
      const tenantId = typeof lease.tenantId === 'object' ? String(lease.tenantId?._id) : String(lease.tenantId);
      tenantIds.push(tenantId);
    });

    const [tenants, units, buildings] = await Promise.all([
      this.tenantModel.find({ _id: { $in: tenantIds.filter(Boolean).map((id) => new Types.ObjectId(id)) } }).lean(),
      this.unitModel.find({ _id: { $in: unitIds.map((id) => new Types.ObjectId(id)) } }).lean(),
      this.buildingModel.find({ _id: { $in: buildingIds.map((id) => new Types.ObjectId(id)) } }).lean(),
    ]);

    const leaseMap = new Map(leases.map((item: any) => [String(item._id), item]));
    const tenantMap = new Map(tenants.map((item: any) => [String(item._id), item]));
    const unitMap = new Map(units.map((item: any) => [String(item._id), item]));
    const buildingMap = new Map(buildings.map((item: any) => [String(item._id), item]));

    const details = readings.map((reading: any) => {
      const lease = leaseMap.get(String(reading.leaseId));
      const tenant =
        typeof lease?.tenantId === 'object'
          ? lease?.tenantId
          : tenantMap.get(String(lease?.tenantId));
      return {
        _id: String(reading._id),
        billingPeriod: reading.billingPeriod,
        utilityType: reading.utilityType,
        utilityTypeName: reading.utilityTypeName,
        lease: getLeaseSummary(lease),
        tenant: getTenantSummary(tenant),
        unit: getUnitSummary(unitMap.get(String(reading.unitId))),
        building: getBuildingSummary(buildingMap.get(String(reading.buildingId))),
        readings: reading.readings,
        consumption: reading.consumption,
        ratePerUnit: roundCurrency(reading.ratePerUnit),
        fixedAmount: roundCurrency(reading.fixedAmount),
        amount: roundCurrency(reading.amount),
        taxAmount: roundCurrency(reading.taxAmount),
        totalAmount: roundCurrency(reading.totalAmount),
        isBilled: reading.isBilled,
        status: reading.status,
        invoiceId: reading.invoiceId ? String(reading.invoiceId) : null,
        createdAt: reading.createdAt,
      };
    });

    return {
      reportName: 'Utility Bills Report',
      summary: {
        totalBills: details.length,
        totalConsumption: roundCurrency(details.reduce((sum, item) => sum + Number(item.consumption || 0), 0)),
        totalAmount: roundCurrency(details.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
        totalTaxAmount: roundCurrency(details.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0)),
        grandTotal: roundCurrency(details.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)),
        billedCount: details.filter((item) => item.isBilled).length,
      },
      details,
      currency: 'USD',
    };
  }
}
