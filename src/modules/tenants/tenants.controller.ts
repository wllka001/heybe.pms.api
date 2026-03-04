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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { CreateTenantDocumentDto } from './dto/create-tenant-document.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { SearchTenantDto } from './dto/search-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { VerifyTenantDocumentDto } from './dto/verify-tenant-document.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateTenantDto) {
    return this.tenantsService.create(req.user.organizationId, dto);
  }

  @Get()
  findAll(@Req() req: any, @Query() query: SearchTenantDto) {
    return this.tenantsService.findAll(req.user.organizationId, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.tenantsService.findOne(req.user.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(req.user.organizationId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.tenantsService.remove(req.user.organizationId, id);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CreateTenantDocumentDto,
    @UploadedFile() file?: any,
  ) {
    return this.tenantsService.uploadDocument(req.user.organizationId, id, dto, file, req.user.id);
  }

  @Get(':id/documents')
  listDocuments(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.tenantsService.listDocuments(req.user.organizationId, id);
  }

  @Patch(':id/documents/:documentId/verify')
  verifyDocument(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('documentId', ParseObjectIdPipe) documentId: string,
    @Body() dto: VerifyTenantDocumentDto,
  ) {
    return this.tenantsService.verifyDocument(
      req.user.organizationId,
      id,
      documentId,
      dto.isVerified,
      req.user.id,
    );
  }

  @Get(':id/payment-history')
  paymentHistory(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.tenantsService.paymentHistory(req.user.organizationId, id);
  }

  @Get(':id/leases')
  leases(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    return this.tenantsService.leaseHistory(req.user.organizationId, id);
  }
}
