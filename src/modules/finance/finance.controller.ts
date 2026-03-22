import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FinanceReportDto } from './dto/finance-report.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { RecordReadingDto } from './dto/record-reading.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('invoices/generate')
  generateInvoices(@Req() req: any, @Body() dto: GenerateInvoicesDto) {
    return this.financeService.generateMonthlyInvoices(req.user.organizationId, dto);
  }

  @Post('invoices')
  createInvoice(@Req() req: any, @Body() dto: CreateInvoiceDto) {
    return this.financeService.createSingleInvoice(req.user.organizationId, dto);
  }

  @Get('invoices')
  listInvoices(
    @Req() req: any,
    @Query()
    query: PaginationDto & {
      status?: string;
      month?: number;
      year?: number;
      buildingId?: string;
    },
  ) {
    return this.financeService.listInvoices(req.user.organizationId, query);
  }

  @Get('invoices/:id')
  getInvoice(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.financeService.getInvoice(req.user.organizationId, id);
  }

  @Get('invoices/:id/pdf')
  async invoicePdf(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    const invoice = await this.financeService.getInvoice(req.user.organizationId, id);
    return {
      invoiceId: invoice._id,
      downloadUrl: `https://files.example.com/invoices/${invoice.invoiceNumber}.pdf`,
    };
  }

  @Post('invoices/:id/reminder')
  sendReminder(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.financeService.sendReminder(req.user.organizationId, id);
  }

  @Post('payments')
  recordPayment(@Req() req: any, @Body() dto: CreatePaymentDto) {
    return this.financeService.recordPayment(req.user.organizationId, dto, req.user.id);
  }

  @Get('payments')
  listPayments(@Req() req: any, @Query() query: ListPaymentsDto) {
    return this.financeService.listPayments(req.user.organizationId, query);
  }

  @Get('payments/:id')
  getPayment(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.financeService.getPayment(req.user.organizationId, id);
  }

  @Get('payments/:id/receipt')
  async paymentReceipt(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    const payment = await this.financeService.getPayment(req.user.organizationId, id);
    return {
      paymentId: payment._id,
      receiptNumber: (payment.receipt as Record<string, unknown>).receiptNumber,
      downloadUrl: `https://files.example.com/receipts/${(payment.receipt as Record<string, unknown>).receiptNumber}.pdf`,
    };
  }

  @Post('payments/:id/verify')
  verifyPayment(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.financeService.updatePaymentLifecycle(
      req.user.organizationId,
      id,
      dto,
      req.user.id,
    );
  }

  @Post('payments/:id/reconcile')
  reconcilePayment(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.financeService.updatePaymentLifecycle(
      req.user.organizationId,
      id,
      { status: 'reconciled' },
      req.user.id,
    );
  }

  @Post('payments/:id/reverse')
  reversePayment(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: { note?: string },
  ) {
    return this.financeService.updatePaymentLifecycle(
      req.user.organizationId,
      id,
      { status: 'reversed', note: body.note },
      req.user.id,
    );
  }

  @Post('readings')
  recordReading(@Req() req: any, @Body() dto: RecordReadingDto) {
    return this.financeService.recordReading(req.user.organizationId, dto, req.user.id);
  }

  @Post('readings/bulk')
  recordReadingBulk(@Req() req: any, @Body() body: { readings: RecordReadingDto[] }) {
    return this.financeService.bulkRecordReadings(
      req.user.organizationId,
      body.readings,
      req.user.id,
    );
  }

  @Get('readings')
  listReadings(
    @Req() req: any,
    @Query()
    query: PaginationDto & {
      leaseId?: string;
      utilityType?: string;
      utilityTypeId?: string;
      month?: number;
      year?: number;
      isBilled?: boolean;
    },
  ) {
    return this.financeService.listReadings(req.user.organizationId, query);
  }

  @Get('readings/unbilled')
  unbilledReadings(@Req() req: any) {
    return this.financeService.unbilledReadings(req.user.organizationId);
  }

  @Post('expenses')
  createExpense(@Req() req: any, @Body() dto: CreateExpenseDto) {
    return this.financeService.createExpense(req.user.organizationId, dto);
  }

  @Get('expenses')
  listExpenses(
    @Req() req: any,
    @Query() query: PaginationDto & { category?: string; buildingId?: string },
  ) {
    return this.financeService.listExpenses(req.user.organizationId, query);
  }

  @Get('expenses/:id')
  getExpense(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.financeService.getExpense(req.user.organizationId, id);
  }

  @Patch('expenses/:id')
  updateExpense(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.financeService.updateExpense(req.user.organizationId, id, dto);
  }

  @Post('expenses/:id/approve')
  approveExpense(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: { status: 'approved' | 'rejected' },
  ) {
    return this.financeService.approveExpense(
      req.user.organizationId,
      id,
      req.user.id,
      body.status,
    );
  }

  @Post('reports/summary')
  report(@Req() req: any, @Body() dto: FinanceReportDto) {
    return this.financeService.financeReport(req.user.organizationId, dto);
  }
}
