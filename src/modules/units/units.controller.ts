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
import { BulkCreateUnitsDto } from './dto/bulk-create-units.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateUnitDto) {
    return this.unitsService.create(req.user.organizationId, dto);
  }

  @Post('bulk')
  bulkCreate(@Req() req: any, @Body() dto: BulkCreateUnitsDto) {
    return this.unitsService.bulkCreate(req.user.organizationId, dto);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query() query: PaginationDto & { buildingId?: string; status?: string },
  ) {
    return this.unitsService.findAll(req.user.organizationId, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.unitsService.findOne(req.user.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.unitsService.update(req.user.organizationId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: { status: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' },
  ) {
    return this.unitsService.updateStatus(req.user.organizationId, id, body.status);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.unitsService.remove(req.user.organizationId, id);
  }

  @Get(':id/lease-history')
  leaseHistory(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.unitsService.leaseHistory(req.user.organizationId, id);
  }
}
