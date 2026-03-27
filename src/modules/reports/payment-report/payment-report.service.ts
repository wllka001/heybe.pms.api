import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Building, BuildingDocument } from '@/modules/buildings/schemas/building.schema';
import { Invoice, InvoiceDocument } from '@/modules/finance/schemas/invoice.schema';
import { Payment, PaymentDocument } from '@/modules/finance/schemas/payment.schema';
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
export class PaymentReportService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
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

    const dateRange = buildDateRange(query);
    if (dateRange) {
      filter.paymentDate = { $gte: dateRange.from, $lte: dateRange.to };
    }
    if (query.leaseId) filter.leaseId = toObjectId(query.leaseId);
    if (query.tenantId) filter.tenantId = toObjectId(query.tenantId);
    if (query.unitId) filter.unitId = toObjectId(query.unitId);
    if (query.buildingId) filter.buildingId = toObjectId(query.buildingId);

    const payments = await this.paymentModel.find(filter).sort({ paymentDate: -1 }).lean();

    const invoiceIds = [...new Set(payments.map((item) => item.invoiceId).filter(Boolean).map((item) => String(item)))];
    const leaseIds = [...new Set(payments.map((item) => String(item.leaseId)))];
    const tenantIds = [...new Set(payments.map((item) => String(item.tenantId)))];
    const unitIds = [...new Set(payments.map((item) => String(item.unitId)))];
    const buildingIds = [...new Set(payments.map((item) => String(item.buildingId)))];

    const [invoices, leases, tenants, units, buildings] = await Promise.all([
      this.invoiceModel.find({ _id: { $in: invoiceIds.map((id) => new Types.ObjectId(id)) } }).lean(),
      this.leaseModel.find({ _id: { $in: leaseIds.map((id) => new Types.ObjectId(id)) } }).lean(),
      this.tenantModel.find({ _id: { $in: tenantIds.map((id) => new Types.ObjectId(id)) } }).lean(),
      this.unitModel.find({ _id: { $in: unitIds.map((id) => new Types.ObjectId(id)) } }).lean(),
      this.buildingModel.find({ _id: { $in: buildingIds.map((id) => new Types.ObjectId(id)) } }).lean(),
    ]);

    const invoiceMap = new Map(invoices.map((item: any) => [String(item._id), item]));
    const leaseMap = new Map(leases.map((item: any) => [String(item._id), item]));
    const tenantMap = new Map(tenants.map((item: any) => [String(item._id), item]));
    const unitMap = new Map(units.map((item: any) => [String(item._id), item]));
    const buildingMap = new Map(buildings.map((item: any) => [String(item._id), item]));

    const details = payments.map((payment: any) => ({
      _id: String(payment._id),
      paymentNumber: payment.paymentNumber,
      tenant: getTenantSummary(tenantMap.get(String(payment.tenantId))),
      lease: getLeaseSummary(leaseMap.get(String(payment.leaseId))),
      unit: getUnitSummary(unitMap.get(String(payment.unitId))),
      building: getBuildingSummary(buildingMap.get(String(payment.buildingId))),
      invoice: (() => {
        const invoice = invoiceMap.get(String(payment.invoiceId));
        if (!invoice) return null;
        return {
          _id: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: roundCurrency(invoice.summary?.totalAmount || 0),
          balance: roundCurrency(invoice.balance || 0),
          status: invoice.status,
        };
      })(),
      amount: roundCurrency(payment.amount || 0),
      paymentDate: payment.paymentDate,
      method: payment.method,
      methodDetails: payment.methodDetails,
      allocation: payment.allocation || [],
      receipt: payment.receipt,
      lifecycle: payment.lifecycle,
      notes: payment.notes,
      createdAt: payment.createdAt,
    }));

    const amountByStatus = (status: string) =>
      roundCurrency(
        details
          .filter((item) => item.lifecycle?.status === status)
          .reduce((sum, item) => sum + item.amount, 0),
      );

    return {
      reportName: 'Payment Report',
      summary: {
        totalPaymentsRecorded: details.length,
        totalRecordedAmount: roundCurrency(details.reduce((sum, item) => sum + item.amount, 0)),
        totalVerified: details.filter((item) => item.lifecycle?.status === 'verified').length,
        totalReconciledAmount: amountByStatus('reconciled'),
        totalReversedAmount: amountByStatus('reversed'),
        totalRejectedAmount: amountByStatus('rejected'),
      },
      details,
      currency: 'USD',
    };
  }
}
