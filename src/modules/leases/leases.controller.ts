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
import { CreateLeaseDto } from './dto/create-lease.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { TerminateLeaseDto } from './dto/terminate-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { LeasesService } from './leases.service';

@Controller('leases')
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateLeaseDto) {
    return this.leasesService.create(req.user.organizationId, dto);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query() query: PaginationDto & { status?: string },
  ) {
    return this.leasesService.findAll(req.user.organizationId, query);
  }

  @Get('active')
  active(@Req() req: any) {
    return this.leasesService.getActiveLeases(req.user.organizationId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.leasesService.findOne(req.user.organizationId, id);
  }

  @Get(':id/invoices')
  invoices(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.leasesService.leaseInvoices(req.user.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateLeaseDto,
  ) {
    return this.leasesService.update(req.user.organizationId, id, dto);
  }

  @Post(':id/terminate')
  terminate(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: TerminateLeaseDto,
  ) {
    return this.leasesService.terminate(req.user.organizationId, id, dto, req.user.id);
  }

  @Post(':id/renew')
  renew(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RenewLeaseDto,
  ) {
    return this.leasesService.renew(req.user.organizationId, id, dto);
  }
}
