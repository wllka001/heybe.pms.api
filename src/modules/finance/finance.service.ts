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
import { generateSequenceCode } from '@/common/utils/generate-code.utils';
import { roundCurrency } from '@/common/utils/number-utils';
import { Lease, LeaseDocument } from '@/modules/leases/schemas/lease.schema';
import { NotificationsService } from '@/shared/notifications/notifications.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FinanceReportDto } from './dto/finance-report.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { RecordReadingDto } from './dto/record-reading.dto';
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
import { calculateLateFee } from './utils/late-fee-calculator';
import { allocatePayment } from './utils/payment-allocation.util';

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Lease.name) private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(UtilityReading.name)
    private readonly utilityReadingModel: Model<UtilityReadingDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generateMonthlyInvoices(
    organizationId: string,
    dto: GenerateInvoicesDto,
  ): Promise<{ created: number; skipped: number }> {
    const orgObjectId = new Types.ObjectId(organizationId);
    const monthStart = startOfMonth(dto.year, dto.month);
    const monthEnd = endOfMonth(dto.year, dto.month);

    const activeLeases = await this.leaseModel
      .find({
        organizationId: orgObjectId,
        status: 'active',
        'period.startDate': { $lte: monthEnd },
        'period.endDate': { $gte: monthStart },
        deletedAt: null,
      })
      .lean();

    let created = 0;
    let skipped = 0;

    for (const lease of activeLeases) {
      const exists = await this.invoiceModel.findOne({
        organizationId: orgObjectId,
        leaseId: lease._id,
        'period.month': dto.month,
        'period.year': dto.year,
        deletedAt: null,
      });

      if (exists) {
        skipped += 1;
        continue;
      }

      const utilityReadings = await this.utilityReadingModel.find({
        organizationId: orgObjectId,
        leaseId: lease._id,
        isBilled: false,
        'billingPeriod.month': dto.month,
        'billingPeriod.year': dto.year,
        deletedAt: null,
      });

      const previousMonth = dto.month === 1 ? 12 : dto.month - 1;
      const previousYear = dto.month === 1 ? dto.year - 1 : dto.year;
      const previousInvoice = await this.invoiceModel.findOne({
        organizationId: orgObjectId,
        leaseId: lease._id,
        status: 'overdue',
        'period.month': previousMonth,
        'period.year': previousYear,
        deletedAt: null,
      });

      const lateFeeAmount = previousInvoice
        ? calculateLateFee(
            previousInvoice.balance,
            lease.terms.lateFeeType,
            lease.terms.lateFeeValue,
          )
        : 0;

      const lateFeeTax = 0;
      const lateFeeTotal = lateFeeAmount + lateFeeTax;

      const items = {
        rent: {
          amount: lease.terms.rentAmount,
          paidAmount: 0,
        },
        utilities: utilityReadings.map((reading: UtilityReadingDocument) => ({
          type: reading.utilityType,
          consumption: reading.consumption,
          rate: reading.ratePerUnit,
          amount: reading.amount,
          tax: reading.taxAmount,
          total: reading.totalAmount,
          readingId: reading._id,
          paidAmount: 0,
        })),
        additionalCharges: lateFeeAmount
          ? [
              {
                description: 'Late fee - previous period',
                amount: lateFeeAmount,
                tax: lateFeeTax,
                total: lateFeeTotal,
                type: 'late_fee',
                paidAmount: 0,
              },
            ]
          : [],
      };

      const summary = calculateInvoiceSummary(items);

      const dueDate = addDays(monthStart, Number(lease.terms.gracePeriodDays ?? 5));

      const invoice = await this.invoiceModel.create({
        organizationId: orgObjectId,
        invoiceNumber: this.generateInvoiceNumber(dto.year, dto.month),
        leaseId: lease._id,
        tenantId: lease.tenantId,
        unitId: lease.unitId,
        buildingId: lease.buildingId,
        period: {
          month: dto.month,
          year: dto.year,
          startDate: monthStart,
          endDate: monthEnd,
          dueDate,
        },
        items,
        summary,
        status: 'pending',
        paidAmount: 0,
        balance: summary.totalAmount,
        lateFee: {
          applied: lateFeeAmount > 0,
          feeAmount: lateFeeAmount,
        },
      });

      if (utilityReadings.length > 0) {
        await this.utilityReadingModel.updateMany(
          {
            _id: {
              $in: utilityReadings.map(
                (reading: UtilityReadingDocument) => reading._id,
              ),
            },
          },
          {
            isBilled: true,
            invoiceId: invoice._id,
            billingDate: new Date(),
          },
        );
      }

      created += 1;
    }

    return { created, skipped };
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
            paymentNumber: this.generatePaymentNumber(),
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
              receiptNumber: this.generateReceiptNumber(),
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

        invoice.paidAmount = roundCurrency(Number(invoice.paidAmount) + Number(row.amount));
        invoice.balance = roundCurrency(invoice.summary.totalAmount - invoice.paidAmount);

        if (invoice.balance <= 0) {
          invoice.balance = 0;
          invoice.status = 'paid';
          invoice.paidAt = now;
        } else {
          invoice.status = 'partially_paid';
        }

        invoice.paymentHistory.push({
          paymentId: payment._id,
          amount: row.amount,
          date: now,
          allocation: [
            {
              itemType: 'rent',
              itemIndex: 0,
              amount: row.amount,
            },
          ],
        });

        await invoice.save({ session });
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

    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.tenantId) {
      filter.tenantId = new Types.ObjectId(query.tenantId);
    }

    if (query.status) {
      filter['lifecycle.status'] = query.status;
    }

    const [data, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.paymentModel.countDocuments(filter),
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

  async getPayment(organizationId: string, id: string): Promise<PaymentDocument> {
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

  async updatePaymentLifecycle(
    organizationId: string,
    id: string,
    dto: VerifyPaymentDto,
    userId: string,
  ): Promise<PaymentDocument> {
    const payment = await this.getPayment(organizationId, id);

    if (dto.status !== 'reversed') {
      const lifecycle = { ...(payment.lifecycle as Record<string, unknown>) };
      lifecycle.status = dto.status;

      if (dto.status === 'verified') {
        lifecycle.verifiedBy = new Types.ObjectId(userId);
        lifecycle.verifiedAt = new Date();
      }

      if (dto.status === 'reconciled') {
        lifecycle.reconciledBy = new Types.ObjectId(userId);
        lifecycle.reconciledAt = new Date();
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

    const currentStatus = (payment.lifecycle as Record<string, unknown>).status as
      | string
      | undefined;
    if (currentStatus === 'reversed') {
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

        invoice.paidAmount = roundCurrency(Math.max(0, invoice.paidAmount - amount));
        invoice.balance = roundCurrency(invoice.summary.totalAmount - invoice.paidAmount);

        if (invoice.paidAmount <= 0) {
          invoice.paidAmount = 0;
          invoice.status =
            invoice.period.dueDate.getTime() < Date.now() ? 'overdue' : 'pending';
          invoice.paidAt = undefined;
        } else if (invoice.balance > 0) {
          invoice.status = 'partially_paid';
          invoice.paidAt = undefined;
        } else {
          invoice.status = 'paid';
        }

        invoice.paymentHistory = invoice.paymentHistory.filter((history) => {
          const historyPaymentId = (history as Record<string, unknown>).paymentId as
            | Types.ObjectId
            | undefined;
          return historyPaymentId?.toString() !== paymentInSession._id.toString();
        });

        await invoice.save({ session });
      }

      const lifecycle = { ...(paymentInSession.lifecycle as Record<string, unknown>) };
      lifecycle.status = 'reversed';
      lifecycle.reversedBy = new Types.ObjectId(userId);
      lifecycle.reversedAt = new Date();
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
    if (dto.currentValue < dto.previousValue) {
      throw new BadRequestException('Current value cannot be lower than previous value.');
    }

    const consumption = roundCurrency(dto.currentValue - dto.previousValue);
    const amount = roundCurrency(consumption * dto.ratePerUnit);
    const taxRate = dto.taxRate ?? 0;
    const taxAmount = roundCurrency((amount * taxRate) / 100);
    const totalAmount = roundCurrency(amount + taxAmount);

    const billingPeriod = {
      month: dto.billingMonth,
      year: dto.billingYear,
      period: `${dto.billingYear}-${String(dto.billingMonth).padStart(2, '0')}`,
    };

    const exists = await this.utilityReadingModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      unitId: new Types.ObjectId(dto.unitId),
      utilityType: dto.utilityType,
      'billingPeriod.month': dto.billingMonth,
      'billingPeriod.year': dto.billingYear,
      deletedAt: null,
    });

    if (exists) {
      throw new ConflictException('Reading already recorded for this period.');
    }

    return this.utilityReadingModel.create({
      organizationId: new Types.ObjectId(organizationId),
      buildingId: new Types.ObjectId(dto.buildingId),
      unitId: new Types.ObjectId(dto.unitId),
      leaseId: new Types.ObjectId(dto.leaseId),
      utilityType: dto.utilityType,
      readings: {
        previous: {
          value: dto.previousValue,
          date: new Date(dto.previousDate),
        },
        current: {
          value: dto.currentValue,
          date: new Date(dto.currentDate),
          readingBy: new Types.ObjectId(userId),
          imageUrl: dto.imageUrl,
          notes: dto.notes,
        },
      },
      consumption,
      ratePerUnit: dto.ratePerUnit,
      amount,
      taxRate,
      taxAmount,
      totalAmount,
      billingPeriod,
      isBilled: false,
      status: 'approved',
    });
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
    const exists = await this.expenseModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      expenseNumber: dto.expenseNumber,
      deletedAt: null,
    });

    if (exists) {
      throw new ConflictException('Expense number already exists.');
    }

    return this.expenseModel.create({
      organizationId: new Types.ObjectId(organizationId),
      expenseNumber: dto.expenseNumber,
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
    const matchBase: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
      createdAt: {
        $gte: new Date(dto.fromDate),
        $lte: new Date(dto.toDate),
      },
    };

    if (dto.buildingId) {
      matchBase.buildingId = new Types.ObjectId(dto.buildingId);
    }

    const [invoiceAgg, paymentAgg, expenseAgg] = await Promise.all([
      this.invoiceModel.aggregate([
        { $match: matchBase },
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: '$summary.totalAmount' },
            totalPaidOnInvoices: { $sum: '$paidAmount' },
            outstandingBalance: { $sum: '$balance' },
          },
        },
      ]),
      this.paymentModel.aggregate([
        { $match: matchBase },
        {
          $group: {
            _id: null,
            totalPaymentsRecorded: { $sum: '$amount' },
          },
        },
      ]),
      this.expenseModel.aggregate([
        { $match: matchBase },
        {
          $group: {
            _id: '$category',
            amount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    return {
      period: {
        fromDate: dto.fromDate,
        toDate: dto.toDate,
      },
      invoicing: invoiceAgg[0] ?? {
        totalInvoiced: 0,
        totalPaidOnInvoices: 0,
        outstandingBalance: 0,
      },
      payments: paymentAgg[0] ?? {
        totalPaymentsRecorded: 0,
      },
      expensesByCategory: expenseAgg,
      currency: 'USD',
    };
  }

  private generateInvoiceNumber(year: number, month: number): string {
    return `INV-${year}-${String(month).padStart(2, '0')}-${generateSequenceCode('')
      .replace(/^-/, '')
      .slice(-8)}`;
  }

  private generatePaymentNumber(): string {
    return generateSequenceCode('PAY');
  }

  private generateReceiptNumber(): string {
    return generateSequenceCode('RCT');
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
}
