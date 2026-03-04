import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UnitDocument = HydratedDocument<Unit>;

@Schema({ timestamps: true, collection: 'units' })
export class Unit {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Building', required: true })
  buildingId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  unitNumber: string;

  @Prop({ required: true })
  floor: number;

  @Prop({
    type: String,
    enum: ['studio', '1-bedroom', '2-bedroom', '3-bedroom', '4-bedroom', 'commercial'],
    required: true,
  })
  type: string;

  @Prop({
    type: {
      bedrooms: Number,
      bathrooms: Number,
      size: String,
      furnished: {
        type: String,
        enum: ['unfurnished', 'semi', 'fully'],
        default: 'unfurnished',
      },
      parkingSpaces: { type: Number, default: 0 },
    },
    default: {},
  })
  specifications: Record<string, unknown>;

  @Prop({
    type: String,
    enum: ['vacant', 'occupied', 'reserved', 'under_maintenance'],
    default: 'vacant'
  })
  status: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance';

  @Prop({ type: Types.ObjectId, ref: 'Tenant' })
  currentTenantId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lease' })
  currentLeaseId?: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  marketRent: number;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const UnitSchema = SchemaFactory.createForClass(Unit);
UnitSchema.index({ organizationId: 1, buildingId: 1, code: 1 }, { unique: true });
UnitSchema.index({ organizationId: 1, buildingId: 1, unitNumber: 1 }, { unique: true });
