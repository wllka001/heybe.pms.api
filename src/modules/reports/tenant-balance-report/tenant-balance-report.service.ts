import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument } from '@/modules/finance/schemas/invoice.schema';
import { Payment, PaymentDocument } from '@/modules/finance/schemas/payment.schema';
import { Lease, LeaseDocument } from '@/modules/leases/schemas/lease.schema';
import { Tenant, TenantDocument } from '@/modules/tenants/schemas/tenant.schema';
import { ReportQueryDto } from '../dto/report-query.dto';
import { buildDateRange, getLeaseSummary, getTenantSummary, roundCurrency, toObjectId } from '../report-helpers';

@Injectable()
export class TenantBalanceReportService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Lease.name) private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
  ) {}

  async generate(organizationId: string, query: ReportQueryDto) {
    const invoiceFilter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };
    const paymentFilter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
      'lifecycle.status': 'reconciled',
    };

    if (query.leaseId) {
      invoiceFilter.leaseId = toObjectId(query.leaseId);
      paymentFilter.leaseId = toObjectId(query.leaseId);
    }
    if (query.tenantId) {
      invoiceFilter.tenantId = toObjectId(query.tenantId);
      paymentFilter.tenantId = toObjectId(query.tenantId);
    }
    if (query.unitId) {
      invoiceFilter.unitId = toObjectId(query.unitId);
      paymentFilter.unitId = toObjectId(query.unitId);
    }
    if (query.buildingId) {
      invoiceFilter.buildingId = toObjectId(query.buildingId);
      paymentFilter.buildingId = toObjectId(query.buildingId);
    }

    const dateRange = buildDateRange(query);
    if (dateRange) {
      invoiceFilter.createdAt = { $gte: dateRange.from, $lte: dateRange.to };
      paymentFilter.paymentDate = { $gte: dateRange.from, $lte: dateRange.to };
    }

    const [invoices, payments, leases, tenants] = await Promise.all([
      this.invoiceModel.find(invoiceFilter).lean(),
      this.paymentModel.find(paymentFilter).lean(),
      this.leaseModel.find({ organizationId: new Types.ObjectId(organizationId), deletedAt: null }).lean(),
      this.tenantModel.find({ organizationId: new Types.ObjectId(organizationId), deletedAt: null }).lean(),
    ]);

    const leaseMap = new Map(leases.map((item: any) => [String(item._id), item]));
    const tenantMap = new Map(tenants.map((item: any) => [String(item._id), item]));
    const grouped = new Map<string, any>();

    invoices.forEach((invoice: any) => {
      const key = String(invoice.tenantId);
      const entry = grouped.get(key) || {
        tenant: getTenantSummary(tenantMap.get(key)),
        lease: getLeaseSummary(leaseMap.get(String(invoice.leaseId))),
        totalInvoiced: 0,
        totalPaid: 0,
      };
      entry.totalInvoiced += Number(invoice.summary?.totalAmount || 0);
      grouped.set(key, entry);
    });

    payments.forEach((payment: any) => {
      const key = String(payment.tenantId);
      const entry = grouped.get(key) || {
        tenant: getTenantSummary(tenantMap.get(key)),
        lease: getLeaseSummary(leaseMap.get(String(payment.leaseId))),
        totalInvoiced: 0,
        totalPaid: 0,
      };
      entry.totalPaid += Number(payment.amount || 0);
      grouped.set(key, entry);
    });

    const details = Array.from(grouped.values()).map((item) => ({
      ...item,
      totalInvoiced: roundCurrency(item.totalInvoiced),
      totalPaid: roundCurrency(item.totalPaid),
      outstandingBalance: roundCurrency(item.totalInvoiced - item.totalPaid),
    }));

    return {
      reportName: 'Tenant Balance Report',
      summary: {
        tenantCount: details.length,
        totalInvoiced: roundCurrency(details.reduce((sum, item) => sum + item.totalInvoiced, 0)),
        totalPaid: roundCurrency(details.reduce((sum, item) => sum + item.totalPaid, 0)),
        outstandingBalance: roundCurrency(details.reduce((sum, item) => sum + item.outstandingBalance, 0)),
      },
      details,
      currency: 'USD',
    };
  }
}
