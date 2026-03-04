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

  @Prop({ type: String, enum: ['water', 'electricity', 'gas'], required: true })
  utilityType: 'water' | 'electricity' | 'gas';

  @Prop({
    type: {
      previous: {
        value: { type: Number, required: true },
        date: { type: Date, required: true },
      },
      current: {
        value: { type: Number, required: true },
        date: { type: Date, required: true },
        readingBy: { type: Types.ObjectId, ref: 'User' },
        imageUrl: String,
        notes: String,
      },
    },
    required: true,
  })
  readings: Record<string, unknown>;

  @Prop({ required: true })
  consumption: number;

  @Prop({ required: true })
  ratePerUnit: number;

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