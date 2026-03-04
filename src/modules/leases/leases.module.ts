import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invoice, InvoiceSchema } from '@/modules/finance/schemas/invoice.schema';
import { Lease, LeaseSchema } from './schemas/lease.schema';
import { Unit, UnitSchema } from '@/modules/units/schemas/unit.schema';
import { Tenant, TenantSchema } from '@/modules/tenants/schemas/tenant.schema';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lease.name, schema: LeaseSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  controllers: [LeasesController],
  providers: [LeasesService],
  exports: [LeasesService, MongooseModule],
})
export class LeasesModule {}
