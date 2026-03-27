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
export class TenantHistoryReportService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Lease.name) private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
  ) {}

  async generate(organizationId: string, query: ReportQueryDto) {
    const orgId = new Types.ObjectId(organizationId);
    const invoiceFilter: Record<string, unknown> = { organizationId: orgId, deletedAt: null };
    const paymentFilter: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

    if (query.tenantId) {
      const tenantId = toObjectId(query.tenantId);
      invoiceFilter.tenantId = tenantId;
      paymentFilter.tenantId = tenantId;
    }
    if (query.leaseId) {
      const leaseId = toObjectId(query.leaseId);
      invoiceFilter.leaseId = leaseId;
      paymentFilter.leaseId = leaseId;
    }

    const monthYearFilter =
      query.billingYear && query.billingMonth
        ? { 'period.year': query.billingYear, 'period.month': query.billingMonth }
        : {};

    const currentMonthInvoices = await this.invoiceModel.find({ ...invoiceFilter, ...monthYearFilter }).lean();
    const currentMonthPayments = await this.paymentModel.find({
      ...paymentFilter,
      ...(buildDateRange(query)
        ? { paymentDate: { $gte: buildDateRange(query)?.from, $lte: buildDateRange(query)?.to } }
        : {}),
    }).lean();

    const [historicalInvoices, historicalPayments, leases, tenants] = await Promise.all([
      this.invoiceModel.find(invoiceFilter).sort({ createdAt: -1 }).lean(),
      this.paymentModel.find(paymentFilter).sort({ paymentDate: -1 }).lean(),
      this.leaseModel.find({ organizationId: orgId, deletedAt: null }).lean(),
      this.tenantModel.find({ organizationId: orgId, deletedAt: null }).lean(),
    ]);

    const leaseMap = new Map(leases.map((item: any) => [String(item._id), item]));
    const tenantMap = new Map(tenants.map((item: any) => [String(item._id), item]));

    const invoiceDetails = historicalInvoices.map((invoice: any) => ({
      type: 'invoice',
      reference: invoice.invoiceNumber,
      tenant: getTenantSummary(tenantMap.get(String(invoice.tenantId))),
      lease: getLeaseSummary(leaseMap.get(String(invoice.leaseId))),
      amount: roundCurrency(invoice.summary?.totalAmount || 0),
      paidAmount: roundCurrency(invoice.paidAmount || 0),
      balance: roundCurrency(invoice.balance || 0),
      status: invoice.status,
      date: invoice.createdAt,
    }));

    const paymentDetails = historicalPayments.map((payment: any) => ({
      type: 'payment',
      reference: payment.paymentNumber,
      tenant: getTenantSummary(tenantMap.get(String(payment.tenantId))),
      lease: getLeaseSummary(leaseMap.get(String(payment.leaseId))),
      amount: roundCurrency(payment.amount || 0),
      status: payment.lifecycle?.status || 'recorded',
      date: payment.paymentDate,
      invoiceId: payment.invoiceId ? String(payment.invoiceId) : null,
    }));

    return {
      reportName: 'Tenant Invoice & Payments History',
      summary: {
        thisMonthInvoiceAmount: roundCurrency(
          currentMonthInvoices.reduce((sum, item) => sum + Number(item.summary?.totalAmount || 0), 0),
        ),
        thisMonthPaidAmount: roundCurrency(
          currentMonthPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        ),
        thisMonthBalance: roundCurrency(
          currentMonthInvoices.reduce((sum, item) => sum + Number(item.balance || 0), 0),
        ),
        totalHistoricalInvoices: historicalInvoices.length,
        totalHistoricalPayments: historicalPayments.length,
      },
      details: {
        invoices: invoiceDetails,
        payments: paymentDetails,
      },
      currency: 'USD',
    };
  }
}
