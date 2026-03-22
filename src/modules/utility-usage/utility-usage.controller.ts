import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { CreateUtilityUsageDto } from './dto/create-utility-usage.dto';
import { SearchUtilityUsageDto } from './dto/search-utility-usage.dto';
import { UpdateUtilityUsageDto } from './dto/update-utility-usage.dto';
import { UtilityUsageService } from './utility-usage.service';

@Controller('utility-types')
export class UtilityUsageController {
  constructor(private readonly utilityUsageService: UtilityUsageService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateUtilityUsageDto) {
    return this.utilityUsageService.create(req.user.organizationId, dto, req.user.id);
  }

  @Get()
  findAll(@Req() req: any, @Query() query: SearchUtilityUsageDto) {
    return this.utilityUsageService.findAll(req.user.organizationId, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.utilityUsageService.findOne(req.user.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUtilityUsageDto,
  ) {
    return this.utilityUsageService.update(req.user.organizationId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.utilityUsageService.remove(req.user.organizationId, id);
  }
}
