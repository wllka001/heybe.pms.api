import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BuildingDocument = HydratedDocument<Building>;

@Schema({ timestamps: true, collection: 'buildings' })
export class Building {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true, default: 'UNT' })
  unitCodePrefix: string;

  @Prop({ required: true, min: 1, default: 4 })
  unitCodeLength: number;

  @Prop({ required: true, trim: true, default: 'TEN' })
  tenantCodePrefix: string;

  @Prop({ required: true, min: 1, default: 4 })
  tenantCodeLength: number;

  @Prop({
    type: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      district: String,
      region: String,
      country: { type: String, default: 'Somalia' },
      postalCode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    required: true,
  })
  address: {
    street: string;
    city: string;
    district?: string;
    region?: string;
    country?: string;
    postalCode?: string;
    coordinates?: { lat?: number; lng?: number };
  };

  @Prop({
    type: {
      totalFloors: Number,
      totalUnits: Number,
      yearBuilt: Number,
      parkingSpaces: Number,
      hasGenerator: Boolean,
      hasWaterTank: Boolean,
      hasSecurity: Boolean,
    },
    default: {},
  })
  details: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  amenities: string[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const BuildingSchema = SchemaFactory.createForClass(Building);
BuildingSchema.index({ organizationId: 1, code: 1 }, { unique: true });
