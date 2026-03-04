import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lease, LeaseSchema } from '@/modules/leases/schemas/lease.schema';
import { UtilityUsageController } from './utility-usage.controller';
import { UtilityUsageService } from './utility-usage.service';
import { UtilityUsage, UtilityUsageSchema } from './schemas/utility-usage.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UtilityUsage.name, schema: UtilityUsageSchema },
      { name: Lease.name, schema: LeaseSchema },
    ]),
  ],
  controllers: [UtilityUsageController],
  providers: [UtilityUsageService],
  exports: [UtilityUsageService, MongooseModule],
})
export class UtilityUsageModule {}

