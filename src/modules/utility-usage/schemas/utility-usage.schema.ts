import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UtilityUsageDocument = HydratedDocument<UtilityUsage>;

@Schema({ timestamps: true, collection: 'utility_usages' })
export class UtilityUsage {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lease', required: true })
  leaseId: Types.ObjectId;

  @Prop({ type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ })
  month: string;

  @Prop({ type: Number, min: 0, default: 0 })
  waterUsed: number;

  @Prop({ type: Number, min: 0, default: 0 })
  electricityUsed: number;

  @Prop({ type: Number, min: 0, default: 0 })
  gasUsed: number;

  @Prop({ type: Types.ObjectId, ref: 'Employee' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const UtilityUsageSchema = SchemaFactory.createForClass(UtilityUsage);
UtilityUsageSchema.index(
  { organizationId: 1, leaseId: 1, month: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

