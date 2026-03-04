import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileUploadModule } from '@/shared/file-upload/file-upload.module';
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from './schemas/maintenance-request.schema';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
    FileUploadModule,
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService, MongooseModule],
})
export class MaintenanceModule {}
