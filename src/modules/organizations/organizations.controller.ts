import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '@/common/decorators/public.decorator';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('logo'))
  create(@Body() body: Record<string, unknown>, @UploadedFile() logo?: any) {
    return this.organizationsService.create(body, logo);
  }

  @Get()
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.organizationsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo'))
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() logo?: any,
  ) {
    return this.organizationsService.update(id, body, logo);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.organizationsService.remove(id);
  }
}
