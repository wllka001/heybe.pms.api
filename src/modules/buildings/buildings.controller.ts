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
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { CreateBuildingDto } from './dto/create-building.dto';
import { ListBuildingsDto } from './dto/list-buildings.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { BuildingsService } from './buildings.service';

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) { }

  @Post()
  create(@Req() req: any, @Body() dto: CreateBuildingDto) {
    // console.log('CreateBuildingDto', req.user.organizationId, dto);
    return this.buildingsService.create(req.user.organizationId, dto);
  }

  @Get()
  findAll(@Req() req: any, @Query() query: ListBuildingsDto) {

    return this.buildingsService.findAll(req.user.organizationId, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.buildingsService.findOne(req.user.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.buildingsService.update(req.user.organizationId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.buildingsService.remove(req.user.organizationId, id);
  }

  @Get(':id/units')
  getUnits(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.buildingsService.getUnits(req.user.organizationId, id);
  }

  @Get(':id/stats')
  getStats(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.buildingsService.getStats(req.user.organizationId, id);
  }

  @Get(':id/structure')
  getStructure(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.buildingsService.getStructure(req.user.organizationId, id);
  }
}
