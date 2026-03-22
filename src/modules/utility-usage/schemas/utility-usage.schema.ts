import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UtilityUsageDocument = HydratedDocument<UtilityUsage>;

@Schema({ timestamps: true, collection: 'utility_types' })
export class UtilityUsage {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, uppercase: true })
  code: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: {
      hasPreviousValue: { type: Boolean, default: false },
      hasCurrentValue: { type: Boolean, default: false },
      hasRatePerUnit: { type: Boolean, default: false },
      hasPreviousDate: { type: Boolean, default: false },
      hasCurrentDate: { type: Boolean, default: false },
      hasFixedMonthlyAmount: { type: Boolean, default: false },
    },
    default: {},
  })
  inputConfig: {
    hasPreviousValue?: boolean;
    hasCurrentValue?: boolean;
    hasRatePerUnit?: boolean;
    hasPreviousDate?: boolean;
    hasCurrentDate?: boolean;
    hasFixedMonthlyAmount?: boolean;
  };

  @Prop({
    type: {
      ratePerUnit: { type: Number, min: 0, default: 0 },
      fixedMonthlyAmount: { type: Number, min: 0, default: 0 },
      taxRate: { type: Number, min: 0, max: 100, default: 0 },
      unitLabel: { type: String, default: '' },
    },
    default: {},
  })
  defaults: {
    ratePerUnit?: number;
    fixedMonthlyAmount?: number;
    taxRate?: number;
    unitLabel?: string;
  };

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Employee' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const UtilityUsageSchema = SchemaFactory.createForClass(UtilityUsage);
UtilityUsageSchema.index(
  { organizationId: 1, code: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
