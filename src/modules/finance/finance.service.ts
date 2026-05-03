import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { addDays, endOfMonth, startOfMonth } from '@/common/utils/date-utils';
import {
  formatSequentialCode,
  generateSequenceCode,
  generateYearMonthPrefix,
  getNextSequentialNumber,
} from '@/common/utils/generate-code.utils';
import { roundCurrency } from '@/common/utils/number-utils';
import { Building, BuildingDocument } from '@/modules/buildings/schemas/building.schema';
import { Lease, LeaseDocument } from '@/modules/leases/schemas/lease.schema';
import { Tenant, TenantDocument } from '@/modules/tenants/schemas/tenant.schema';
import { UtilityUsage, UtilityUsageDocument } from '@/modules/utility-usage/schemas/utility-usage.schema';
import { NotificationsService } from '@/shared/notifications/notifications.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FinanceReportDto } from './dto/finance-report.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { RecordReadingDto } from './dto/record-reading.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { Expense, ExpenseDocument } from './schemas/expense.schema';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import {
  UtilityReading,
  UtilityReadingDocument,
} from './schemas/utility-reading.schema';
import { calculateInvoiceSummary } from './utils/invoice-calculator';
import { allocatePayment } from './utils/payment-allocation.util';

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Building.name)
    private readonly buildingModel: Model<BuildingDocument>,
    @InjectModel(Lease.name) private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(UtilityReading.name)
    private readonly utilityReadingModel: Model<UtilityReadingDocument>,
    @InjectModel(UtilityUsage.name)
    private readonly utilityTypeModel: Model<UtilityUsageDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly notificationsService: NotificationsService,
  ) { }

  async generateMonthlyInvoices(
    organizationId: string,
    dto: GenerateInvoicesDto,
  ): Promise<{ created: number; skipped: number }> {
    const orgObjectId = new Types.ObjectId(organizationId);
    const activeLeases = await this.getActiveLeasesForPeriod(orgObjectId, dto.year, dto.month);

    let created = 0;
    let skipped = 0;

    for (const lease of activeLeases) {
      const existingInvoice = await this.invoiceModel.findOne({
        organizationId: orgObjectId,
        leaseId: lease._id,
        'period.month': dto.month,
        'period.year': dto.year,
        deletedAt: null,
      });

      if (existingInvoice && !dto.regenerate) {
        skipped += 1;
        continue;
      }

      const draft = await this.buildInvoiceDraft(
        orgObjectId,
        lease,
        dto,
        existingInvoice ?? undefined,
      );
      const now = new Date();

      let invoice: InvoiceDocument;
      if (existingInvoice) {
        existingInvoice.items = draft.items;
        existingInvoice.summary = draft.summary;
        existingInvoice.period = draft.period;
        existingInvoice.lateFee = draft.lateFee;
        this.syncInvoiceAccounting(existingInvoice, Number(existingInvoice.paidAmount ?? 0), now);
        invoice = await existingInvoice.save();
      } else {
        invoice = await this.invoiceModel.create({
          organizationId: orgObjectId,
          invoiceNumber: await this.generateInvoiceNumber(orgObjectId, dto.year, dto.month),
          leaseId: lease._id,
          tenantId: lease.tenantId._id,
          unitId: lease.unitId._id,
          buildingId: lease.buildingId,
          period: draft.period,
          items: draft.items,
          summary: draft.summary,
          status: 'pending',
          paidAmount: 0,
          balance: draft.summary.totalAmount,
          lateFee: draft.lateFee,
        });
      }

      if (draft.utilityReadings.length > 0) {
        await this.utilityReadingModel.updateMany(
          {
            _id: {
              $in: draft.utilityReadings.map((reading: UtilityReadingDocument) => reading._id),
            },
          },
          {
            isBilled: true,
            invoiceId: invoice._id,
            billingDate: now,
          },
        );
      }

      created += 1;
    }

    return { created, skipped };
  }

  async previewMonthlyInvoices(organizationId: string, dto: GenerateInvoicesDto) {
    const orgObjectId = new Types.ObjectId(organizationId);
    const activeLeases = await this.getActiveLeasesForPeriod(orgObjectId, dto.year, dto.month);
    const invoices = [];

    for (const lease of activeLeases) {
      const existingInvoice = await this.invoiceModel.findOne({
        organizationId: orgObjectId,
        leaseId: lease._id,
        'period.month': dto.month,
        'period.year': dto.year,
        deletedAt: null,
      });

      const draft = await this.buildInvoiceDraft(
        orgObjectId,
        lease,
        dto,
        existingInvoice ?? undefined,
      );

      invoices.push({
        leaseId: lease._id,
        leaseNumber: lease.leaseNumber,
        unitCode:
          typeof lease.unitId === 'object' && lease.unitId !== null && 'unitNumber' in lease.unitId
            ? String((lease.unitId as { unitNumber?: string }).unitNumber ?? '')
            : null,
        tenantName: this.getTenantName(lease.tenantId),
        tenantPhone: this.getTenantPhone(lease.tenantId),
        invoiceId: existingInvoice?._id ?? null,
        invoiceNumber: existingInvoice?.invoiceNumber ?? null,
        action: existingInvoice ? 'regenerate' : 'generate',
        period: draft.period,
        rentAmount: draft.items.rent.amount,
        utilityCount: draft.items.utilities.length,
        summary: draft.summary,
        items: draft.items,
      });
    }

    return {
      month: dto.month,
      year: dto.year,
      regenerate: Boolean(dto.regenerate),
      invoices,
      summary: {
        leaseCount: invoices.length,
        generateCount: invoices.filter((invoice) => invoice.action === 'generate').length,
        regenerateCount: invoices.filter((invoice) => invoice.action === 'regenerate').length,
        totalAmount: roundCurrency(
          invoices.reduce((sum, invoice) => sum + Number(invoice.summary?.totalAmount ?? 0), 0),
        ),
      },
    };
  }

  async createSingleInvoice(
    organizationId: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceDocument> {
    const orgObjectId = new Types.ObjectId(organizationId);
    const lease = await this.leaseModel.findOne({
      _id: new Types.ObjectId(dto.leaseId),
      organizationId: orgObjectId,
      deletedAt: null,
    });

    if (!lease) {
      throw new NotFoundException('Lease not found.');
    }

    const duplicate = await this.invoiceModel.findOne({
      organizationId: orgObjectId,
      leaseId: lease._id,
      'period.month': dto.month,
      'period.year': dto.year,
      deletedAt: null,
    });

    if (duplicate) {
      throw new ConflictException('Invoice already exists for this lease and period.');
    }

    const monthStart = startOfMonth(dto.year, dto.month);
    const monthEnd = endOfMonth(dto.year, dto.month);

    const utilityRows = (dto.utilities ?? []).map((utility) => {
      const amount = roundCurrency(Number(utility.amount));
      const tax = roundCurrency(Number(utility.tax ?? 0));
      return {
        type: utility.type,
        consumption: Number(utility.consumption ?? 1),
        rate: Number(utility.rate ?? amount),
        amount,
        tax,
        total: roundCurrency(amount + tax),
        paidAmount: 0,
      };
    });

    const additionalRows = (dto.additionalCharges ?? []).map((charge) => {
      const amount = roundCurrency(Number(charge.amount));
      const tax = roundCurrency(Number(charge.tax ?? 0));
      return {
        description: charge.description,
        amount,
        tax,
        total: roundCurrency(amount + tax),
        type: 'other',
        paidAmount: 0,
      };
    });

    const items = {
      rent: {
        amount: roundCurrency(Number(dto.rentAmount ?? lease.terms.rentAmount)),
        paidAmount: 0,
      },
      utilities: utilityRows,
      additionalCharges: additionalRows,
    };

    const summary = calculateInvoiceSummary(items);

    return this.invoiceModel.create({
      organizationId: orgObjectId,
      invoiceNumber: await this.generateInvoiceNumber(orgObjectId, dto.year, dto.month),
      leaseId: lease._id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      buildingId: lease.buildingId,
      period: {
        month: dto.month,
        year: dto.year,
        startDate: monthStart,
        endDate: monthEnd,
        dueDate: new Date(dto.dueDate),
      },
      items,
      summary,
      status: 'pending',
      paidAmount: 0,
      balance: summary.totalAmount,
      lateFee: {
        applied: false,
        feeAmount: 0,
      },
    });
  }

  async listInvoices(
    organizationId: string,
    query: PaginationDto & {
      status?: string;
      month?: number;
      year?: number;
      buildingId?: string;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.month !== undefined) {
      filter['period.month'] = Number(query.month);
    }

    if (query.year !== undefined) {
      filter['period.year'] = Number(query.year);
    }

    if (query.buildingId) {
      filter.buildingId = new Types.ObjectId(query.buildingId);
    }

    const [data, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .sort({ 'period.year': -1, 'period.month': -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.invoiceModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async getInvoice(organizationId: string, id: string): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    return invoice;
  }

  async sendReminder(organizationId: string, id: string): Promise<{ sent: boolean }> {
    const invoice = await this.getInvoice(organizationId, id);
    await this.notificationsService.sendEmail(
      'tenant@example.com',
      `Payment Reminder - ${invoice.invoiceNumber}`,
      'invoice-reminder',
      {
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.summary.totalAmount,
        dueDate: invoice.period.dueDate,
      },
    );
    return { sent: true };
  }

  async recordPayment(
    organizationId: string,
    dto: CreatePaymentDto,
    userId: string,
  ): Promise<PaymentDocument> {
    this.validatePaymentMethodDetails(dto.method, dto.methodDetails);

    const orgObjectId = new Types.ObjectId(organizationId);
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      console.log(dto)
      console.log(orgObjectId)
      const openInvoices = await this.invoiceModel
        .find({
          organizationId: orgObjectId,
          tenantId: new Types.ObjectId(dto.tenantId),
          status: { $in: ['pending', 'overdue', 'partially_paid'] },
          balance: { $gt: 0 },
          deletedAt: null,
        })
        .sort({ 'period.dueDate': 1, createdAt: 1 })
        .session(session);
      console.log(openInvoices)
      if (!openInvoices.length && !dto.allocation?.length) {
        throw new BadRequestException('No open invoices for this tenant.');
      }

      const invoiceMap = new Map<string, InvoiceDocument>(
        openInvoices.map((invoice: InvoiceDocument) => [
          invoice._id.toString(),
          invoice,
        ]),
      );

      let allocationRows = dto.allocation?.map((row) => ({
        invoiceId: row.invoiceId,
        amount: row.amount,
      }));

      if (dto.invoiceId && (!allocationRows || allocationRows.length === 0)) {
        const selectedInvoice = invoiceMap.get(dto.invoiceId);
        if (!selectedInvoice) {
          throw new BadRequestException('Selected invoice is fully paid or unavailable.');
        }

        allocationRows = [
          {
            invoiceId: dto.invoiceId,
            amount: Math.min(Number(dto.amount), Number(selectedInvoice.balance)),
          },
        ];
      }

      if (!allocationRows || allocationRows.length === 0) {
        allocationRows = allocatePayment(
          dto.amount,
          openInvoices.map((invoice: InvoiceDocument) => ({
            id: invoice._id.toString(),
            balance: invoice.balance,
          })),
        ).allocations;
      }

      const allocatedTotal = roundCurrency(
        allocationRows.reduce((sum, row) => sum + row.amount, 0),
      );

      if (allocatedTotal <= 0) {
        throw new BadRequestException('Payment could not be allocated.');
      }

      if (allocatedTotal > dto.amount) {
        throw new BadRequestException('Allocated amount exceeds payment amount.');
      }

      const allocationPayload = dto.allocation?.length
        ? dto.allocation.map((row) => ({
          invoiceId: new Types.ObjectId(row.invoiceId),
          itemType: row.itemType,
          itemIndex: row.itemIndex ?? 0,
          amount: row.amount,
        }))
        : allocationRows.map((row) => ({
          invoiceId: new Types.ObjectId(row.invoiceId),
          itemType: 'rent',
          itemIndex: 0,
          amount: row.amount,
        }));

      const now = new Date();
      const paymentList = await this.paymentModel.create(
        [
          {
            organizationId: orgObjectId,
            paymentNumber: await this.generatePaymentNumber(orgObjectId),
            tenantId: new Types.ObjectId(dto.tenantId),
            leaseId: new Types.ObjectId(dto.leaseId),
            invoiceId: dto.invoiceId ? new Types.ObjectId(dto.invoiceId) : undefined,
            unitId: new Types.ObjectId(dto.unitId),
            buildingId: new Types.ObjectId(dto.buildingId),
            amount: allocatedTotal,
            currency: 'USD',
            paymentDate: new Date(dto.paymentDate),
            method: dto.method,
            methodDetails: dto.methodDetails,
            allocation: allocationPayload,
            receipt: {
              receiptNumber: await this.generateReceiptNumber(orgObjectId),
              generatedAt: now,
              sentToTenant: false,
            },
            lifecycle: {
              status: 'recorded',
            },
            recordedBy: new Types.ObjectId(userId),
            recordedAt: now,
            notes: dto.notes,
          },
        ],
        { session },
      );

      const payment = paymentList[0];

      for (const row of allocationRows) {
        const invoice = invoiceMap.get(row.invoiceId);
        if (!invoice) {
          throw new BadRequestException(
            `Invoice ${row.invoiceId} is not open or not found for allocation.`,
          );
        }
        if (Number(row.amount) > Number(invoice.balance)) {
          throw new BadRequestException(
            `Allocated amount exceeds the remaining balance for invoice ${invoice.invoiceNumber}.`,
          );
        }
      }

      await session.commitTransaction();
      return payment;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async listPayments(organizationId: string, query: ListPaymentsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const organizationObjectId = new Types.ObjectId(organizationId);

    const filter: Record<string, unknown> = {
      organizationId: organizationObjectId,
      deletedAt: null,
    };

    if (query.tenantId) {
      filter.tenantId = new Types.ObjectId(query.tenantId);
    }

    if (query.leaseId) {
      filter.leaseId = new Types.ObjectId(query.leaseId);
    }

    if (query.status) {
      filter['lifecycle.status'] = query.status;
    }

    if (query.year || query.month) {
      const year = query.year ?? new Date().getFullYear();
      const startDate = query.month
        ? new Date(year, query.month - 1, 1)
        : new Date(year, 0, 1);
      const endDate = query.month
        ? new Date(year, query.month, 1)
        : new Date(year + 1, 0, 1);

      filter.paymentDate = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const search = query.search?.trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      const [matchingTenants, matchingInvoices, matchingLeases] = await Promise.all([
        this.tenantModel
          .find({
            organizationId: organizationObjectId,
            deletedAt: null,
            $or: [
              { tenantCode: regex },
              { 'personalInfo.firstName': regex },
              { 'personalInfo.middleName': regex },
              { 'personalInfo.lastName': regex },
              { 'contact.primaryPhone': regex },
              { 'contact.secondaryPhone': regex },
              { 'contact.email': regex },
            ],
          })
          .select('_id')
          .lean(),
        this.invoiceModel
          .find({
            organizationId: organizationObjectId,
            deletedAt: null,
            invoiceNumber: regex,
          })
          .select('_id')
          .lean(),
        this.leaseModel
          .find({
            organizationId: organizationObjectId,
            deletedAt: null,
            leaseNumber: regex,
          })
          .select('_id')
          .lean(),
      ]);

      filter.$or = [
        { paymentNumber: regex },
        { 'receipt.receiptNumber': regex },
        { notes: regex },
        { tenantId: { $in: matchingTenants.map((tenant) => tenant._id) } },
        { invoiceId: { $in: matchingInvoices.map((invoice) => invoice._id) } },
        { leaseId: { $in: matchingLeases.map((lease) => lease._id) } },
      ];
    }

    const [data, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .populate('invoiceId')
        .populate('tenantId')
        .populate('leaseId')
        .populate('unitId')
        .populate('buildingId')
        .populate('recordedBy', 'firstName lastName username email')
        .populate('lifecycle.verifiedBy', 'firstName lastName username email')
        .populate('lifecycle.reconciledBy', 'firstName lastName username email')
        .populate('lifecycle.rejectedBy', 'firstName lastName username email')
        .populate('lifecycle.reversedBy', 'firstName lastName username email')
        .populate('allocation.invoiceId', 'invoiceNumber items summary balance status')
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.paymentModel.countDocuments(filter),
    ]);

    return {
      data: data.map((payment) => this.formatPaymentResponse(payment)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async getPayment(organizationId: string, id: string): Promise<any> {
    const payment = await this.getPaymentEntity(organizationId, id);
    await payment.populate('invoiceId');
    await payment.populate('tenantId');
    await payment.populate('leaseId');
    await payment.populate('unitId');
    await payment.populate('buildingId');
    await payment.populate('recordedBy', 'firstName lastName username email');
    await payment.populate('lifecycle.verifiedBy', 'firstName lastName username email');
    await payment.populate('lifecycle.reconciledBy', 'firstName lastName username email');
    await payment.populate('lifecycle.rejectedBy', 'firstName lastName username email');
    await payment.populate('lifecycle.reversedBy', 'firstName lastName username email');
    await payment.populate('allocation.invoiceId', 'invoiceNumber items summary balance status');

    return this.formatPaymentResponse(payment);
  }

  private async getPaymentEntity(organizationId: string, id: string): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    return payment;
  }

  async updatePayment(
    organizationId: string,
    id: string,
    dto: UpdatePaymentDto,
  ): Promise<PaymentDocument> {
    const payment = await this.getPaymentEntity(organizationId, id);
    const status =
      ((payment.lifecycle as Record<string, unknown>).status as string | undefined) ?? 'recorded';

    if (!['recorded', 'verified'].includes(status)) {
      throw new BadRequestException('Only recorded or verified payments can be edited.');
    }

    if (dto.method) {
      this.validatePaymentMethodDetails(dto.method, dto.methodDetails ?? payment.methodDetails);
      payment.method = dto.method;
    } else if (dto.methodDetails) {
      this.validatePaymentMethodDetails(payment.method, dto.methodDetails);
    }

    if (dto.amount !== undefined) {
      payment.amount = roundCurrency(Number(dto.amount));
    }
    if (dto.paymentDate) {
      payment.paymentDate = new Date(dto.paymentDate);
    }
    if (dto.methodDetails) {
      payment.methodDetails = dto.methodDetails;
    }
    if (dto.notes !== undefined) {
      payment.notes = dto.notes;
    }

    await payment.save();
    return payment;
  }

  async updatePaymentLifecycle(
    organizationId: string,
    id: string,
    dto: VerifyPaymentDto,
    userId: string,
  ): Promise<PaymentDocument> {
    const payment = await this.getPaymentEntity(organizationId, id);
    const currentStatus =
      ((payment.lifecycle as Record<string, unknown>).status as string | undefined) ?? 'recorded';
    const nextStatus = dto.status;
    const now = new Date();

    if (currentStatus === nextStatus) {
      return payment;
    }

    const allowedTransitions: Record<string, string[]> = {
      recorded: ['verified', 'rejected'],
      verified: ['reconciled'],
      reconciled: ['reversed'],
      rejected: [],
      reversed: [],
    };

    if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
      throw new BadRequestException(
        `Payment cannot move from ${currentStatus} to ${nextStatus}.`,
      );
    }

    if (nextStatus === 'rejected' && !dto.note?.trim()) {
      throw new BadRequestException('Reject reason is required.');
    }

    if (nextStatus === 'verified' || nextStatus === 'rejected') {
      const lifecycle = { ...(payment.lifecycle as Record<string, unknown>) };
      lifecycle.status = nextStatus;

      if (nextStatus === 'verified') {
        lifecycle.verifiedBy = new Types.ObjectId(userId);
        lifecycle.verifiedAt = now;
      }

      if (nextStatus === 'rejected') {
        lifecycle.rejectedBy = new Types.ObjectId(userId);
        lifecycle.rejectedAt = now;
      }

      if (dto.note) {
        lifecycle.notes = lifecycle.notes
          ? `${String(lifecycle.notes)}\n${dto.note}`
          : dto.note;
      }

      payment.lifecycle = lifecycle;
      await payment.save();
      return payment;
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const paymentInSession = await this.paymentModel.findOne({
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      }).session(session);

      if (!paymentInSession) {
        throw new NotFoundException('Payment not found.');
      }

      for (const row of paymentInSession.allocation as Array<Record<string, unknown>>) {
        const invoiceId = row.invoiceId as Types.ObjectId;
        const amount = Number(row.amount ?? 0);
        if (!invoiceId || amount <= 0) {
          continue;
        }

        const invoice = await this.invoiceModel.findOne({
          _id: invoiceId,
          organizationId: new Types.ObjectId(organizationId),
          deletedAt: null,
        }).session(session);

        if (!invoice) {
          continue;
        }

        if (nextStatus === 'reconciled') {
          invoice.paidAmount = roundCurrency(Number(invoice.paidAmount) + amount);
          invoice.paymentHistory.push({
            paymentId: paymentInSession._id,
            amount,
            date: now,
            allocation: [
              {
                itemType: (row.itemType as string) || 'rent',
                itemIndex: Number(row.itemIndex ?? 0),
                amount,
              },
            ],
          });
        } else if (nextStatus === 'reversed') {
          invoice.paidAmount = roundCurrency(Math.max(0, Number(invoice.paidAmount) - amount));
          invoice.paymentHistory = invoice.paymentHistory.filter((history) => {
            const historyPaymentId = (history as Record<string, unknown>).paymentId as
              | Types.ObjectId
              | undefined;
            return historyPaymentId?.toString() !== paymentInSession._id.toString();
          });
        }

        this.syncInvoiceAccounting(invoice, Number(invoice.paidAmount ?? 0), now);

        await invoice.save({ session });
      }

      const lifecycle = { ...(paymentInSession.lifecycle as Record<string, unknown>) };
      lifecycle.status = nextStatus;
      if (nextStatus === 'reconciled') {
        lifecycle.reconciledBy = new Types.ObjectId(userId);
        lifecycle.reconciledAt = now;
      }
      if (nextStatus === 'reversed') {
        lifecycle.reversedBy = new Types.ObjectId(userId);
        lifecycle.reversedAt = now;
      }
      if (dto.note) {
        lifecycle.notes = lifecycle.notes
          ? `${String(lifecycle.notes)}\n${dto.note}`
          : dto.note;
      }
      paymentInSession.lifecycle = lifecycle;

      await paymentInSession.save({ session });

      await session.commitTransaction();
      return paymentInSession;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async recordReading(
    organizationId: string,
    dto: RecordReadingDto,
    userId: string,
  ): Promise<UtilityReadingDocument> {
    const orgObjectId = new Types.ObjectId(organizationId);
    const utilityType = await this.utilityTypeModel.findOne({
      _id: new Types.ObjectId(dto.utilityTypeId),
      organizationId: orgObjectId,
      deletedAt: null,
    });

    if (!utilityType) {
      throw new NotFoundException('Utility type not found.');
    }

    if (!utilityType.isActive) {
      throw new BadRequestException('Selected utility type is inactive.');
    }

    const config = utilityType.inputConfig ?? {};
    const defaults = utilityType.defaults ?? {};

    if (config.hasPreviousValue && dto.previousValue === undefined) {
      throw new BadRequestException('Previous value is required for this utility type.');
    }
    if (config.hasCurrentValue && dto.currentValue === undefined) {
      throw new BadRequestException('Current value is required for this utility type.');
    }
    if (config.hasRatePerUnit && dto.ratePerUnit === undefined && defaults.ratePerUnit === undefined) {
      throw new BadRequestException('Rate per unit is required for this utility type.');
    }
    if (config.hasPreviousDate && !dto.previousDate) {
      throw new BadRequestException('Previous date is required for this utility type.');
    }
    if (config.hasCurrentDate && !dto.currentDate) {
      throw new BadRequestException('Current date is required for this utility type.');
    }

    const previousValue = Number(dto.previousValue ?? 0);
    const currentValue = Number(dto.currentValue ?? 0);
    if (config.hasPreviousValue && config.hasCurrentValue && currentValue < previousValue) {
      throw new BadRequestException('Current value cannot be lower than previous value.');
    }

    const consumption = config.hasPreviousValue && config.hasCurrentValue
      ? roundCurrency(currentValue - previousValue)
      : 0;

    const ratePerUnit = Number(dto.ratePerUnit ?? defaults.ratePerUnit ?? 0);
    const variableAmount = roundCurrency(consumption * ratePerUnit);
    const fixedAmount = config.hasFixedMonthlyAmount
      ? roundCurrency(Number(dto.fixedAmount ?? defaults.fixedMonthlyAmount ?? 0))
      : 0;

    const amount = roundCurrency(variableAmount + fixedAmount);
    const taxRate = dto.taxRate ?? Number(defaults.taxRate ?? 0);
    const taxAmount = roundCurrency((amount * taxRate) / 100);
    const totalAmount = roundCurrency(amount + taxAmount);

    const billingPeriod = {
      month: dto.billingMonth,
      year: dto.billingYear,
      period: `${dto.billingYear}-${String(dto.billingMonth).padStart(2, '0')}`,
    };

    const exists = await this.utilityReadingModel.findOne({
      organizationId: orgObjectId,
      leaseId: new Types.ObjectId(dto.leaseId),
      utilityTypeId: utilityType._id,
      'billingPeriod.month': dto.billingMonth,
      'billingPeriod.year': dto.billingYear,
      deletedAt: null,
    });

    if (exists) {
      throw new ConflictException('Reading already recorded for this period.');
    }

    return this.utilityReadingModel.create({
      organizationId: orgObjectId,
      buildingId: new Types.ObjectId(dto.buildingId),
      unitId: new Types.ObjectId(dto.unitId),
      leaseId: new Types.ObjectId(dto.leaseId),
      utilityTypeId: utilityType._id,
      utilityType: utilityType.code,
      utilityTypeName: utilityType.name,
      readings: {
        previous: {
          value: dto.previousValue,
          date: dto.previousDate ? new Date(dto.previousDate) : undefined,
        },
        current: {
          value: dto.currentValue,
          date: dto.currentDate ? new Date(dto.currentDate) : undefined,
          readingBy: new Types.ObjectId(userId),
          imageUrl: dto.imageUrl,
          notes: dto.notes,
        },
      },
      consumption,
      ratePerUnit,
      fixedAmount,
      amount,
      taxRate,
      taxAmount,
      totalAmount,
      billingPeriod,
      isBilled: false,
      status: 'approved',
    });
  }

  async updateReading(
    organizationId: string,
    id: string,
    dto: RecordReadingDto,
    userId: string,
  ): Promise<UtilityReadingDocument> {
    const reading = await this.utilityReadingModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!reading) {
      throw new NotFoundException('Reading not found.');
    }

    const duplicate = await this.utilityReadingModel.findOne({
      _id: { $ne: reading._id },
      organizationId: new Types.ObjectId(organizationId),
      leaseId: new Types.ObjectId(dto.leaseId),
      utilityTypeId: new Types.ObjectId(dto.utilityTypeId),
      'billingPeriod.month': dto.billingMonth,
      'billingPeriod.year': dto.billingYear,
      deletedAt: null,
    });

    if (duplicate) {
      throw new ConflictException('Reading already recorded for this lease and period.');
    }

    reading.deletedAt = new Date();
    await reading.save();

    const recreated = await this.recordReading(organizationId, dto, userId);
    recreated.isBilled = reading.isBilled;
    recreated.invoiceId = reading.invoiceId;
    recreated.billingDate = reading.billingDate;
    recreated.status = reading.status;
    await recreated.save();
    return recreated;
  }

  async bulkRecordReadings(
    organizationId: string,
    readings: RecordReadingDto[],
    userId: string,
  ) {
    const result = [];
    for (const reading of readings) {
      result.push(await this.recordReading(organizationId, reading, userId));
    }
    return result;
  }

  async listReadings(
    organizationId: string,
    query: PaginationDto & {
      leaseId?: string;
      utilityType?: string;
      utilityTypeId?: string;
      month?: number;
      year?: number;
      isBilled?: boolean;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.leaseId) {
      filter.leaseId = new Types.ObjectId(query.leaseId);
    }

    if (query.utilityType) {
      filter.utilityType = query.utilityType;
    }

    if (query.utilityTypeId) {
      filter.utilityTypeId = new Types.ObjectId(query.utilityTypeId);
    }

    if (query.month !== undefined) {
      filter['billingPeriod.month'] = Number(query.month);
    }

    if (query.year !== undefined) {
      filter['billingPeriod.year'] = Number(query.year);
    }

    if (query.isBilled !== undefined) {
      filter.isBilled = query.isBilled;
    }

    const [data, total] = await Promise.all([
      this.utilityReadingModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.utilityReadingModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async unbilledReadings(organizationId: string) {
    return this.utilityReadingModel.find({
      organizationId: new Types.ObjectId(organizationId),
      isBilled: false,
      deletedAt: null,
    });
  }

  async createExpense(
    organizationId: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseDocument> {
    const orgObjectId = new Types.ObjectId(organizationId);
    let expenseNumber = dto.expenseNumber;

    if (!expenseNumber) {
      expenseNumber = await this.generateNextExpenseNumber(organizationId);
    } else {
      const exists = await this.expenseModel.findOne({
        organizationId: orgObjectId,
        expenseNumber,
        deletedAt: null,
      });

      if (exists) {
        throw new ConflictException('Expense number already exists.');
      }
    }

    return this.expenseModel.create({
      organizationId: orgObjectId,
      expenseNumber,
      category: dto.category,
      subCategory: dto.subCategory,
      description: dto.description,
      amount: dto.amount,
      currency: 'USD',
      buildingId: dto.buildingId ? new Types.ObjectId(dto.buildingId) : undefined,
      unitId: dto.unitId ? new Types.ObjectId(dto.unitId) : undefined,
      maintenanceRequestId: dto.maintenanceRequestId
        ? new Types.ObjectId(dto.maintenanceRequestId)
        : undefined,
      vendorId: dto.vendorId ? new Types.ObjectId(dto.vendorId) : undefined,
      payee: dto.payee,
      expenseDate: new Date(dto.expenseDate),
      payment: dto.payment ?? {},
      approval: {
        required: dto.approval?.required ?? false,
        status: 'pending',
      },
    });
  }

  async listExpenses(
    organizationId: string,
    query: PaginationDto & { category?: string; buildingId?: string },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.category) {
      filter.category = query.category;
    }

    if (query.buildingId) {
      filter.buildingId = new Types.ObjectId(query.buildingId);
    }

    const [data, total] = await Promise.all([
      this.expenseModel
        .find(filter)
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.expenseModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async getExpense(organizationId: string, id: string): Promise<ExpenseDocument> {
    const expense = await this.expenseModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    return expense;
  }

  async updateExpense(
    organizationId: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseDocument> {
    const payload: Record<string, unknown> = { ...dto };

    if (dto.buildingId) payload.buildingId = new Types.ObjectId(dto.buildingId);
    if (dto.unitId) payload.unitId = new Types.ObjectId(dto.unitId);
    if (dto.maintenanceRequestId) {
      payload.maintenanceRequestId = new Types.ObjectId(dto.maintenanceRequestId);
    }
    if (dto.vendorId) payload.vendorId = new Types.ObjectId(dto.vendorId);
    if (dto.expenseDate) payload.expenseDate = new Date(dto.expenseDate);

    const expense = await this.expenseModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      payload,
      { new: true },
    );

    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    return expense;
  }

  async approveExpense(
    organizationId: string,
    id: string,
    userId: string,
    status: 'approved' | 'rejected',
  ): Promise<ExpenseDocument> {
    const expense = await this.getExpense(organizationId, id);
    expense.approval = {
      ...(expense.approval as Record<string, unknown>),
      status,
      approvedBy: new Types.ObjectId(userId),
      approvedAt: new Date(),
    };

    await expense.save();
    return expense;
  }

  async financeReport(
    organizationId: string,
    dto: FinanceReportDto,
  ): Promise<Record<string, unknown>> {
    const { organizationObjectId, fromDate, toDate, invoiceMatch, paymentMatch, expenseMatch } =
      this.getFinanceReportFilters(organizationId, dto);

    const [invoiceAgg, paymentAgg, expenseAgg, invoiceStatusBreakdown, paymentStatusBreakdown] =
      await Promise.all([
        this.invoiceModel.aggregate([
          { $match: invoiceMatch },
          {
            $group: {
              _id: null,
              totalInvoiced: { $sum: '$summary.totalAmount' },
              totalPaidOnInvoices: { $sum: '$paidAmount' },
              outstandingBalance: { $sum: '$balance' },
              invoiceCount: { $sum: 1 },
            },
          },
        ]),
        this.paymentModel.aggregate([
          { $match: paymentMatch },
          {
            $group: {
              _id: null,
              totalPaymentsRecorded: { $sum: '$amount' },
              paymentCount: { $sum: 1 },
            },
          },
        ]),
        this.expenseModel.aggregate([
          { $match: expenseMatch },
          {
            $group: {
              _id: '$category',
              amount: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { amount: -1 } },
        ]),
        this.invoiceModel.aggregate([
          { $match: invoiceMatch },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              amount: { $sum: '$summary.totalAmount' },
            },
          },
          { $sort: { amount: -1 } },
        ]),
        this.paymentModel.aggregate([
          { $match: paymentMatch },
          {
            $group: {
              _id: '$lifecycle.status',
              count: { $sum: 1 },
              amount: { $sum: '$amount' },
            },
          },
          { $sort: { amount: -1 } },
        ]),
      ]);

    const invoiceSummary = invoiceAgg[0] ?? {
      totalInvoiced: 0,
      totalPaidOnInvoices: 0,
      outstandingBalance: 0,
      invoiceCount: 0,
    };
    const paymentSummary = paymentAgg[0] ?? {
      totalPaymentsRecorded: 0,
      paymentCount: 0,
    };
    const totalExpenses = expenseAgg.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );
    const buildingName = dto.buildingId
      ? (await this.buildingModel
        .findOne({
          _id: new Types.ObjectId(dto.buildingId),
          organizationId: organizationObjectId,
          deletedAt: null,
        })
        .lean())?.name ?? null
      : null;

    return {
      period: {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
      building: dto.buildingId
        ? {
          buildingId: dto.buildingId,
          name: buildingName,
        }
        : null,
      currency: 'USD',
      summary: {
        totalInvoiced: roundCurrency(invoiceSummary.totalInvoiced ?? 0),
        totalCollected: roundCurrency(paymentSummary.totalPaymentsRecorded ?? 0),
        outstandingBalance: roundCurrency(invoiceSummary.outstandingBalance ?? 0),
        totalExpenses: roundCurrency(totalExpenses),
        netCashflow: roundCurrency(
          Number(paymentSummary.totalPaymentsRecorded ?? 0) - totalExpenses,
        ),
      },
      invoicing: invoiceSummary,
      payments: paymentSummary,
      invoiceStatusBreakdown: invoiceStatusBreakdown.map((item) => ({
        status: item._id || 'unknown',
        count: item.count,
        amount: roundCurrency(item.amount ?? 0),
      })),
      paymentStatusBreakdown: paymentStatusBreakdown.map((item) => ({
        status: item._id || 'recorded',
        count: item.count,
        amount: roundCurrency(item.amount ?? 0),
      })),
      expensesByCategory: expenseAgg.map((item) => ({
        category: item._id || 'other',
        count: item.count,
        amount: roundCurrency(item.amount ?? 0),
      })),
    };
  }

  async financeReportDetails(
    organizationId: string,
    dto: FinanceReportDto,
  ): Promise<Record<string, unknown>> {
    const { fromDate, toDate, invoiceMatch, paymentMatch, expenseMatch } =
      this.getFinanceReportFilters(organizationId, dto);

    const [invoices, payments, expenses] = await Promise.all([
      this.invoiceModel
        .find(invoiceMatch)
        .populate('tenantId')
        .populate('buildingId')
        .populate('unitId')
        .sort({ createdAt: -1 })
        .lean(),
      this.paymentModel
        .find(paymentMatch)
        .populate('invoiceId')
        .populate('tenantId')
        .populate('leaseId')
        .populate('unitId')
        .populate('buildingId')
        .populate('recordedBy', 'firstName lastName username email')
        .populate('lifecycle.verifiedBy', 'firstName lastName username email')
        .populate('lifecycle.reconciledBy', 'firstName lastName username email')
        .populate('lifecycle.rejectedBy', 'firstName lastName username email')
        .populate('lifecycle.reversedBy', 'firstName lastName username email')
        .populate('allocation.invoiceId', 'invoiceNumber items summary balance status')
        .sort({ paymentDate: -1, createdAt: -1 }),
      this.expenseModel
        .find(expenseMatch)
        .populate('buildingId')
        .sort({ expenseDate: -1, createdAt: -1 })
        .lean(),
    ]);

    const formattedPayments = payments.map((payment) =>
      this.formatPaymentResponse(payment),
    );

    const invoiceRows = invoices.map((invoice: any) => ({
      _id: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber,
      tenant: this.formatTenantSummary(invoice.tenantId),
      building: this.formatBuildingSummary(invoice.buildingId),
      unit: this.formatUnitSummary(invoice.unitId),
      period: invoice.period,
      summary: invoice.summary,
      paidAmount: roundCurrency(invoice.paidAmount ?? 0),
      balance: roundCurrency(invoice.balance ?? 0),
      status: invoice.status,
      paymentCount: Array.isArray(invoice.paymentHistory)
        ? invoice.paymentHistory.length
        : 0,
      createdAt: invoice.createdAt,
    }));

    const expenseRows = expenses.map((expense: any) => ({
      _id: String(expense._id),
      expenseNumber: expense.expenseNumber,
      category: expense.category,
      subCategory: expense.subCategory,
      description: expense.description,
      amount: roundCurrency(expense.amount ?? 0),
      currency: expense.currency ?? 'USD',
      building: this.formatBuildingSummary(expense.buildingId),
      payee: expense.payee,
      expenseDate: expense.expenseDate,
      payment: expense.payment,
      approval: expense.approval,
      createdAt: expense.createdAt,
    }));

    return {
      period: {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
      currency: 'USD',
      invoices: invoiceRows,
      payments: formattedPayments,
      expenses: expenseRows,
      monthlyTrend: this.buildFinanceMonthlyTrend(
        invoiceRows,
        formattedPayments,
        expenseRows,
      ),
    };
  }

  private getFinanceReportFilters(
    organizationId: string,
    dto: FinanceReportDto,
  ) {
    const organizationObjectId = new Types.ObjectId(organizationId);
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const invoiceMatch: Record<string, unknown> = {
      organizationId: organizationObjectId,
      deletedAt: null,
      createdAt: {
        $gte: fromDate,
        $lte: toDate,
      },
    };
    const paymentMatch: Record<string, unknown> = {
      organizationId: organizationObjectId,
      deletedAt: null,
      paymentDate: {
        $gte: fromDate,
        $lte: toDate,
      },
    };
    const expenseMatch: Record<string, unknown> = {
      organizationId: organizationObjectId,
      deletedAt: null,
      expenseDate: {
        $gte: fromDate,
        $lte: toDate,
      },
    };

    if (dto.buildingId) {
      const buildingObjectId = new Types.ObjectId(dto.buildingId);
      invoiceMatch.buildingId = buildingObjectId;
      paymentMatch.buildingId = buildingObjectId;
      expenseMatch.buildingId = buildingObjectId;
    }

    return {
      organizationObjectId,
      fromDate,
      toDate,
      invoiceMatch,
      paymentMatch,
      expenseMatch,
    };
  }

  private buildFinanceMonthlyTrend(
    invoices: any[],
    payments: any[],
    expenses: any[],
  ) {
    const trend = new Map<
      string,
      { month: string; invoiced: number; collected: number; expenses: number }
    >();

    const ensureEntry = (key: string) => {
      const existing = trend.get(key);
      if (existing) {
        return existing;
      }

      const created = { month: key, invoiced: 0, collected: 0, expenses: 0 };
      trend.set(key, created);
      return created;
    };

    invoices.forEach((invoice) => {
      const date = new Date(invoice.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const entry = ensureEntry(key);
      entry.invoiced += Number(invoice.summary?.totalAmount ?? 0);
    });

    payments.forEach((payment) => {
      const date = new Date(payment.paymentDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const entry = ensureEntry(key);
      entry.collected += Number(payment.amount ?? 0);
    });

    expenses.forEach((expense) => {
      const date = new Date(expense.expenseDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const entry = ensureEntry(key);
      entry.expenses += Number(expense.amount ?? 0);
    });

    return Array.from(trend.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((item) => ({
        ...item,
        invoiced: roundCurrency(item.invoiced),
        collected: roundCurrency(item.collected),
        expenses: roundCurrency(item.expenses),
        net: roundCurrency(item.collected - item.expenses),
      }));
  }

  private async generateNextExpenseNumber(organizationId: string): Promise<string> {
    const yearMonth = generateYearMonthPrefix();
    const prefix = `EXP-${yearMonth}-`;

    const items = await this.expenseModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        expenseNumber: new RegExp(`^${prefix}`),
        deletedAt: null,
      })
      .select('expenseNumber')
      .lean();

    const sequence = getNextSequentialNumber(
      items.map((i: any) => i.expenseNumber),
      prefix,
    );

    return formatSequentialCode(prefix, 4, sequence);
  }

  private async generateInvoiceNumber(
    organizationId: string | Types.ObjectId,
    year: number,
    month: number,
  ): Promise<string> {
    const monthStr = String(month).padStart(2, '0');
    const prefix = `INV-${year}-${monthStr}-`;

    const items = await this.invoiceModel
      .find({
        organizationId: new Types.ObjectId(organizationId.toString()),
        invoiceNumber: new RegExp(`^${prefix}`),
        deletedAt: null,
      })
      .select('invoiceNumber')
      .lean();

    const sequence = getNextSequentialNumber(
      items.map((i: any) => i.invoiceNumber),
      prefix,
    );

    return formatSequentialCode(prefix, 4, sequence);
  }

  private async generatePaymentNumber(organizationId: string | Types.ObjectId): Promise<string> {
    const yearMonth = generateYearMonthPrefix();
    const prefix = `PMT-${yearMonth}-`;

    const items = await this.paymentModel
      .find({
        organizationId: new Types.ObjectId(organizationId.toString()),
        paymentNumber: new RegExp(`^${prefix}`),
        deletedAt: null,
      })
      .select('paymentNumber')
      .lean();

    const sequence = getNextSequentialNumber(
      items.map((i: any) => i.paymentNumber),
      prefix,
    );

    return formatSequentialCode(prefix, 4, sequence);
  }

  private async generateReceiptNumber(organizationId: string | Types.ObjectId): Promise<string> {
    const yearMonth = generateYearMonthPrefix();
    const prefix = `RCP-${yearMonth}-`;

    const items = await this.paymentModel
      .find({
        organizationId: new Types.ObjectId(organizationId.toString()),
        'receipt.receiptNumber': new RegExp(`^${prefix}`),
        deletedAt: null,
      })
      .select('receipt.receiptNumber')
      .lean();

    const sequence = getNextSequentialNumber(
      items.map((i: any) => i.receipt?.receiptNumber),
      prefix,
    );

    return formatSequentialCode(prefix, 4, sequence);
  }

  private validatePaymentMethodDetails(
    method: 'evc' | 'merchant' | 'bank',
    details: Record<string, unknown>,
  ): void {
    if (method === 'evc') {
      const evc = details.evc as Record<string, unknown> | undefined;
      if (!evc?.referenceNumber) {
        throw new BadRequestException('EVC referenceNumber is required.');
      }
      return;
    }

    if (method === 'merchant') {
      const merchant = details.merchant as Record<string, unknown> | undefined;
      if (!merchant?.referenceNumber) {
        throw new BadRequestException('Merchant referenceNumber is required.');
      }
      return;
    }

    const bank = details.bank as Record<string, unknown> | undefined;
    if (!bank?.transactionId) {
      throw new BadRequestException('Bank transactionId is required.');
    }
  }

  private async getActiveLeasesForPeriod(
    organizationId: Types.ObjectId,
    year: number,
    month: number,
  ) {
    const monthStart = startOfMonth(year, month);
    const monthEnd = endOfMonth(year, month);

    return this.leaseModel
      .find({
        organizationId,
        status: 'active',
        'period.startDate': { $lte: monthEnd },
        'period.endDate': { $gte: monthStart },
        deletedAt: null,
      })
      .populate('tenantId')
      .populate('unitId')
      .lean();
  }

  private async buildInvoiceDraft(
    organizationId: Types.ObjectId,
    lease: Record<string, any>,
    dto: GenerateInvoicesDto,
    _existingInvoice?: InvoiceDocument,
  ) {
    const monthStart = startOfMonth(dto.year, dto.month);
    const monthEnd = endOfMonth(dto.year, dto.month);
    const utilityReadings = await this.utilityReadingModel.find({
      organizationId,
      leaseId: lease._id,
      'billingPeriod.month': dto.month,
      'billingPeriod.year': dto.year,
      deletedAt: null,
    });

    const lateFeeAmount = 0;
    const garbageFee = Number(lease.utilities?.garbageFee ?? 0);
    const securityFee = Number(lease.utilities?.securityFee ?? 0);

    const fixedUtilityRows = [
      ...(garbageFee > 0
        ? [
          {
            type: 'garbage',
            consumption: 1,
            rate: garbageFee,
            amount: garbageFee,
            tax: 0,
            total: garbageFee,
            paidAmount: 0,
          },
        ]
        : []),
      ...(securityFee > 0
        ? [
          {
            type: 'security',
            consumption: 1,
            rate: securityFee,
            amount: securityFee,
            tax: 0,
            total: securityFee,
            paidAmount: 0,
          },
        ]
        : []),
    ];

    const items = {
      rent: {
        amount: Number(lease.terms?.rentAmount ?? 0),
        paidAmount: 0,
      },
      utilities: [
        ...utilityReadings.map((reading: UtilityReadingDocument) => {
          const readings = (reading.readings ?? {}) as {
            previous?: { value?: number };
            current?: { value?: number };
          };

          return {
            type: reading.utilityType,
            consumption: reading.consumption,
            rate: reading.ratePerUnit,
            amount: reading.amount,
            tax: reading.taxAmount,
            total: reading.totalAmount,
            description: reading.utilityTypeName,
            previousValue: readings.previous?.value,
            currentValue: readings.current?.value,
            readingId: reading._id,
            paidAmount: 0,
          };
        }),
        ...fixedUtilityRows,
      ],
      additionalCharges: [
        ...(lateFeeAmount > 0
          ? [
            {
              description: 'Late fee - previous period',
              amount: lateFeeAmount,
              tax: 0,
              total: lateFeeAmount,
              type: 'late_fee',
              paidAmount: 0,
            },
          ]
          : []),
      ],
    };

    return {
      utilityReadings,
      items,
      summary: calculateInvoiceSummary(items),
      lateFee: {
        applied: lateFeeAmount > 0,
        feeAmount: lateFeeAmount,
      },
      period: {
        month: dto.month,
        year: dto.year,
        startDate: monthStart,
        endDate: monthEnd,
        dueDate: addDays(monthStart, Number(lease.terms?.gracePeriodDays ?? 5)),
      },
    };
  }

  private syncInvoiceAccounting(invoice: InvoiceDocument, paidAmount: number, now: Date) {
    invoice.paidAmount = roundCurrency(Math.max(0, paidAmount));
    invoice.balance = roundCurrency(Number(invoice.summary.totalAmount ?? 0) - invoice.paidAmount);

    if (invoice.balance <= 0) {
      invoice.balance = 0;
      invoice.status = 'paid';
      invoice.paidAt = now;
      return;
    }

    invoice.paidAt = undefined;
    if (invoice.paidAmount > 0) {
      invoice.status = 'partially_paid';
      return;
    }

    invoice.status = invoice.period.dueDate.getTime() < now.getTime() ? 'overdue' : 'pending';
  }

  private getTenantName(tenant: Record<string, any> | Types.ObjectId | undefined) {
    if (!tenant || tenant instanceof Types.ObjectId) {
      return null;
    }

    return `${tenant.personalInfo?.firstName || ''} ${tenant.personalInfo?.lastName || ''}`.trim();
  }

  private getTenantPhone(tenant: Record<string, any> | Types.ObjectId | undefined) {
    if (!tenant || tenant instanceof Types.ObjectId) {
      return null;
    }

    return tenant.contact?.primaryPhone ?? null;
  }

  private formatPaymentResponse(payment: any) {
    const lifecycle = { ...(payment.lifecycle?.toObject?.() ?? payment.lifecycle ?? {}) };

    return {
      ...(payment.toObject?.() ?? payment),
      recordedBy: this.formatAuditUser(payment.recordedBy),
      lifecycle: {
        ...lifecycle,
        verifiedBy: this.formatAuditUser(lifecycle.verifiedBy),
        reconciledBy: this.formatAuditUser(lifecycle.reconciledBy),
        rejectedBy: this.formatAuditUser(lifecycle.rejectedBy),
        reversedBy: this.formatAuditUser(lifecycle.reversedBy),
      },
      tenantId: this.formatTenantSummary(payment.tenantId),
      leaseId: this.formatLeaseSummary(payment.leaseId),
      unitId: this.formatUnitSummary(payment.unitId),
      buildingId: this.formatBuildingSummary(payment.buildingId),
      invoiceId: this.formatInvoiceSummary(payment.invoiceId),
      allocation: Array.isArray(payment.allocation)
        ? payment.allocation.map((row: any) => ({
          ...(row.toObject?.() ?? row),
          invoiceId: this.formatInvoiceSummary(row.invoiceId),
        }))
        : [],
    };
  }

  private formatAuditUser(user: any) {
    if (!user || user instanceof Types.ObjectId || typeof user === 'string') {
      return user ?? null;
    }

    const firstName = user.firstName || '';
    const lastName = user.lastName || '';

    return {
      _id: user._id,
      username: user.username || null,
      email: user.email || null,
      fullName: `${firstName} ${lastName}`.trim() || user.username || user.email || null,
    };
  }

  private formatTenantSummary(tenant: any) {
    if (!tenant || tenant instanceof Types.ObjectId || typeof tenant === 'string') {
      return tenant ?? null;
    }

    return {
      _id: tenant._id,
      tenantCode: tenant.tenantCode || null,
      personalInfo: tenant.personalInfo || {},
      contact: tenant.contact || {},
    };
  }

  private formatLeaseSummary(lease: any) {
    if (!lease || lease instanceof Types.ObjectId || typeof lease === 'string') {
      return lease ?? null;
    }

    return {
      _id: lease._id,
      leaseNumber: lease.leaseNumber || null,
      terms: lease.terms || {},
    };
  }

  private formatUnitSummary(unit: any) {
    if (!unit || unit instanceof Types.ObjectId || typeof unit === 'string') {
      return unit ?? null;
    }

    return {
      _id: unit._id,
      unitNumber: unit.unitNumber || null,
    };
  }

  private formatBuildingSummary(building: any) {
    if (!building || building instanceof Types.ObjectId || typeof building === 'string') {
      return building ?? null;
    }

    return {
      _id: building._id,
      name: building.name || null,
    };
  }

  private formatInvoiceSummary(invoice: any) {
    if (!invoice || invoice instanceof Types.ObjectId || typeof invoice === 'string') {
      return invoice ?? null;
    }

    return {
      _id: invoice._id,
      invoiceNumber: invoice.invoiceNumber || null,
      status: invoice.status || null,
      balance: invoice.balance ?? 0,
      items: invoice.items || {},
      summary: invoice.summary || {},
      period: invoice.period || {},
      paidAmount: invoice.paidAmount ?? 0,
    };
  }
}
