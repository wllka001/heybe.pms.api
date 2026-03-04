import { Controller, Get, Query, Req } from '@nestjs/common';
import { ArrearsReportDto } from './dto/arrears-report.dto';
import { ExpenseReportDto } from './dto/expense-report.dto';
import { OccupancyReportDto } from './dto/occupancy-report.dto';
import { RentRollReportDto } from './dto/rent-roll-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
