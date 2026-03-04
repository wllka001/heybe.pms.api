import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { AddAttachmentDto } from './dto/add-attachment.dto';
import { AddCostDto } from './dto/add-cost.dto';
import { AssignWorkOrderDto } from './dto/assign-work-order.dto';
import { CompleteRequestDto } from './dto/complete-request.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('requests')
  createRequest(@Req() req: any, @Body() dto: CreateRequestDto) {
    return this.maintenanceService.createRequest(
      req.user.organizationId,
      dto,
      req.user.id,
    );
  }

  @Get('requests')
  listRequests(
    @Req() req: any,
    @Query() query: PaginationDto & { status?: string; priority?: string },
  ) {
    return this.maintenanceService.listRequests(req.user.organizationId, query);
  }

  @Get('requests/:id')
  getRequest(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.maintenanceService.getRequest(req.user.organizationId, id);
  }

  @Patch('requests/:id')
  updateRequest(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateRequestDto,
  ) {
    return this.maintenanceService.updateRequest(req.user.organizationId, id, dto);
  }

  @Post('requests/:id/assign')
  assign(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AssignWorkOrderDto,
  ) {
    return this.maintenanceService.assignRequest(
      req.user.organizationId,
      id,
      dto,
      req.user.id,
    );
  }

  @Post('requests/:id/status')
  updateStatus(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.maintenanceService.updateStatus(
      req.user.organizationId,
      id,
      dto.status,
      req.user.id,
      dto.notes,
    );
  }

  @Post('requests/:id/cost')
  addCost(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: AddCostDto,
  ) {
    return this.maintenanceService.addCost(
      req.user.organizationId,
      id,
      body,
      req.user.id,
    );
  }

  @Post('requests/:id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AddAttachmentDto,
    @UploadedFile() file?: any,
  ) {
    return this.maintenanceService.addAttachment(
      req.user.organizationId,
      id,
      dto,
      req.user.id,
      file,
    );
  }

  @Post('requests/:id/complete')
  complete(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CompleteRequestDto,
  ) {
    return this.maintenanceService.completeRequest(
      req.user.organizationId,
      id,
      dto,
      req.user.id,
    );
  }

  @Post('vendors')
  createVendor(@Req() req: any, @Body() dto: CreateVendorDto) {
    return this.maintenanceService.createVendor(req.user.organizationId, dto);
  }

  @Get('vendors')
  listVendors(@Req() req: any) {
    return this.maintenanceService.listVendors(req.user.organizationId);
  }

  @Get('vendors/:id')
  getVendor(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.maintenanceService.getVendor(req.user.organizationId, id);
  }

  @Patch('vendors/:id')
  updateVendor(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.maintenanceService.updateVendor(req.user.organizationId, id, dto);
  }
}
