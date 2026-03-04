import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { ProcessPayrollDto } from './dto/process-payroll.dto';
import { PayrollService } from './payroll.service';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('generate')
  generate(@Req() req: any, @Body() dto: CreatePayrollDto) {
    return this.payrollService.generate(req.user.organizationId, dto);
  }

  @Get()
  findAll(@Req() req: any, @Query() query: PaginationDto) {
    return this.payrollService.findAll(req.user.organizationId, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.payrollService.findOne(req.user.organizationId, id);
  }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.payrollService.approve(req.user.organizationId, id, req.user.id);
  }

  @Post(':id/process')
  process(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ProcessPayrollDto,
  ) {
    return this.payrollService.process(req.user.organizationId, id, dto);
  }

  @Post(':id/employee/:employeeId')
  updateEmployeeItem(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('employeeId', ParseObjectIdPipe) employeeId: string,
    @Body()
    body: {
      allowances?: number;
      overtime?: number;
      bonus?: number;
      tax?: number;
      loans?: number;
      other?: number;
    },
  ) {
    return this.payrollService.updateEmployeeItem(
      req.user.organizationId,
      id,
      employeeId,
      body,
    );
  }
}
