import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DepositRefundDocument = HydratedDocument<DepositRefund>;

@Schema({ timestamps: true, collection: 'deposit_refunds' })
export class DepositRefund {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lease', required: true })
  leaseId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true })
  refundDate: Date;

  @Prop({
    type: String,
    enum: ['evc', 'merchant', 'bank', 'cash'],
    required: true,
  })
  method: 'evc' | 'merchant' | 'bank' | 'cash';

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recordedBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const DepositRefundSchema = SchemaFactory.createForClass(DepositRefund);
