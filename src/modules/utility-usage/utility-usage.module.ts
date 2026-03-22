import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UtilityUsageController } from './utility-usage.controller';
import { UtilityUsageService } from './utility-usage.service';
import { UtilityUsage, UtilityUsageSchema } from './schemas/utility-usage.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UtilityUsage.name, schema: UtilityUsageSchema },
    ]),
  ],
  controllers: [UtilityUsageController],
  providers: [UtilityUsageService],
  exports: [UtilityUsageService, MongooseModule],
})
export class UtilityUsageModule {}
