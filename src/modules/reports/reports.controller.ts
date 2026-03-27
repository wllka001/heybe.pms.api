import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ExpenseReportService } from './expense-report/expense-report.service';
import { GeneralFinanceReportService } from './general-finance-report/general-finance-report.service';
import { InvoiceReportService } from './invoice-report/invoice-report.service';
import { PaymentReportService } from './payment-report/payment-report.service';
import { ArrearsReportDto } from './dto/arrears-report.dto';
import { ExpenseReportDto } from './dto/expense-report.dto';
import { OccupancyReportDto } from './dto/occupancy-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { RentRollReportDto } from './dto/rent-roll-report.dto';
import { TenantBalanceReportService } from './tenant-balance-report/tenant-balance-report.service';
import { TenantHistoryReportService } from './tenant-history-report/tenant-history-report.service';
import { ReportsService } from './reports.service';
import { UtilityBillsReportService } from './utility-bills-report/utility-bills-report.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly utilityBillsReportService: UtilityBillsReportService,
    private readonly invoiceReportService: InvoiceReportService,
    private readonly paymentReportService: PaymentReportService,
    private readonly expenseReportService: ExpenseReportService,
    private readonly generalFinanceReportService: GeneralFinanceReportService,
    private readonly tenantBalanceReportService: TenantBalanceReportService,
    private readonly tenantHistoryReportService: TenantHistoryReportService,
  ) {}

  @Post('utility-bills')
  utilityBillsReport(@Req() req: any, @Body() body: ReportQueryDto) {
    return this.utilityBillsReportService.generate(req.user.organizationId, body);
  }

  @Post('invoices')
  invoiceReport(@Req() req: any, @Body() body: ReportQueryDto) {
    return this.invoiceReportService.generate(req.user.organizationId, body);
  }

  @Post('payments')
  paymentReport(@Req() req: any, @Body() body: ReportQueryDto) {
    return this.paymentReportService.generate(req.user.organizationId, body);
  }

  @Post('expenses')
  expenseReport(@Req() req: any, @Body() body: ReportQueryDto) {
    return this.expenseReportService.generate(req.user.organizationId, body);
  }

  @Post('general-finance')
  generalFinanceReport(@Req() req: any, @Body() body: ReportQueryDto) {
    return this.generalFinanceReportService.generate(req.user.organizationId, body);
  }

  @Post('tenant-balances')
  tenantBalanceReport(@Req() req: any, @Body() body: ReportQueryDto) {
    return this.tenantBalanceReportService.generate(req.user.organizationId, body);
  }

  @Post('tenant-history')
  tenantHistoryReport(@Req() req: any, @Body() body: ReportQueryDto) {
    return this.tenantHistoryReportService.generate(req.user.organizationId, body);
  }

  @Get('rent-roll')
  rentRoll(@Req() req: any, @Query() query: RentRollReportDto) {
    return this.reportsService.rentRoll(req.user.organizationId, query.buildingId);
  }

  @Get('arrears')
  arrears(@Req() req: any, @Query() query: ArrearsReportDto) {
    return this.reportsService.arrears(req.user.organizationId, query.buildingId);
  }

  @Get('occupancy')
  occupancy(@Req() req: any, @Query() query: OccupancyReportDto) {
    return this.reportsService.occupancy(req.user.organizationId, query.buildingId);
  }

  @Get('income-expense')
  incomeExpense(@Req() req: any, @Query() query: ExpenseReportDto) {
    return this.reportsService.incomeExpense(
      req.user.organizationId,
      query.fromDate,
      query.toDate,
    );
  }

  @Get('expenses-by-category')
  expensesByCategory(@Req() req: any, @Query() query: ExpenseReportDto) {
    return this.reportsService.expensesByCategory(
      req.user.organizationId,
      query.fromDate,
      query.toDate,
    );
  }

  @Get('maintenance-summary')
  maintenanceSummary(@Req() req: any) {
    return this.reportsService.maintenanceSummary(req.user.organizationId);
  }

  @Get('tenant-turnover')
  tenantTurnover(@Req() req: any) {
    return this.reportsService.tenantTurnover(req.user.organizationId);
  }

  @Get('cash-flow')
  cashFlow(@Req() req: any) {
    return this.reportsService.cashFlowProjection(req.user.organizationId);
  }
}
