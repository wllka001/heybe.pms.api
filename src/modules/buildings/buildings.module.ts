import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Organization,
  OrganizationSchema,
} from '@/modules/organizations/schemas/organization.schema';
import { Building, BuildingSchema } from './schemas/building.schema';
import { Unit, UnitSchema } from '@/modules/units/schemas/unit.schema';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Unit.name, schema: UnitSchema },
    ]),
  ],
  controllers: [BuildingsController],
  providers: [BuildingsService],
  exports: [BuildingsService, MongooseModule],
})
export class BuildingsModule {}
