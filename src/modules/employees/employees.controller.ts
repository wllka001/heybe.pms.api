import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(req.user.organizationId, dto);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query() query: PaginationDto & { status?: string },
  ) {
    return this.employeesService.findAll(req.user.organizationId, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.employeesService.findOne(req.user.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(req.user.organizationId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.employeesService.remove(req.user.organizationId, id);
  }
}
