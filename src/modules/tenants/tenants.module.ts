import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Building, BuildingSchema } from '@/modules/buildings/schemas/building.schema';
import { Payment, PaymentSchema } from '@/modules/finance/schemas/payment.schema';
import { Lease, LeaseSchema } from '@/modules/leases/schemas/lease.schema';
import { FileUploadModule } from '@/shared/file-upload/file-upload.module';
import { TenantFile, TenantFileSchema } from './schemas/tenant-document.schema';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: TenantFile.name, schema: TenantFileSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    FileUploadModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService, MongooseModule],
})
export class TenantsModule {}
