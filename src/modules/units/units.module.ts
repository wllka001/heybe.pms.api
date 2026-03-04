import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Building, BuildingSchema } from '@/modules/buildings/schemas/building.schema';
import { Lease, LeaseSchema } from '@/modules/leases/schemas/lease.schema';
import { Unit, UnitSchema } from './schemas/unit.schema';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
    ]),
  ],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService, MongooseModule],
})
export class UnitsModule {}
