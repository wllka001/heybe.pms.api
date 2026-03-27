import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UtilityReadingDocument = HydratedDocument<UtilityReading>;

@Schema({ timestamps: true, collection: 'utility_readings' })
export class UtilityReading {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Building', required: true })
  buildingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lease', required: true })
  leaseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'UtilityUsage', required: true })
  utilityTypeId: Types.ObjectId;

  @Prop({ type: String, required: true })
  utilityType: string;

  @Prop({ type: String, required: true })
  utilityTypeName: string;

  @Prop({
    type: {
      previous: {
        value: { type: Number },
        date: { type: Date },
      },
      current: {
        value: { type: Number },
        date: { type: Date },
        readingBy: { type: Types.ObjectId, ref: 'User' },
        imageUrl: String,
        notes: String,
      },
    },
    default: {},
  })
  readings: Record<string, unknown>;

  @Prop({ required: true })
  consumption: number;

  @Prop({ required: true })
  ratePerUnit: number;

  @Prop({ type: Number, default: 0 })
  fixedAmount: number;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  taxRate: number;

  @Prop({ required: true })
  taxAmount: number;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ type: Types.ObjectId, ref: 'Invoice' })
  invoiceId?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  isBilled: boolean;

  @Prop({ type: Date })
  billingDate?: Date;

  @Prop({
    type: {
      month: { type: Number, required: true },
      year: { type: Number, required: true },
      period: { type: String, required: true },
    },
    required: true,
  })
  billingPeriod: {
    month: number;
    year: number;
    period: string;
  };

  @Prop({ type: String, enum: ['draft', 'approved', 'rejected'], default: 'draft' })
  status: 'draft' | 'approved' | 'rejected';

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const UtilityReadingSchema = SchemaFactory.createForClass(UtilityReading);
UtilityReadingSchema.index(
  {
    organizationId: 1,
    leaseId: 1,
    utilityTypeId: 1,
    'billingPeriod.year': 1,
    'billingPeriod.month': 1,
  },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
