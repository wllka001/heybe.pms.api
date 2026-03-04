import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LeaseDocument = HydratedDocument<Lease>;

@Schema({ timestamps: true, collection: 'leases' })
export class Lease {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  leaseNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Building', required: true })
  buildingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({
    type: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      duration: { type: Number, required: true },
      isAutoRenew: { type: Boolean, default: false },
      renewalNoticeDays: { type: Number, default: 60 },
    },
    required: true,
  })
  period: {
    startDate: Date;
    endDate: Date;
    duration: number;
    isAutoRenew: boolean;
    renewalNoticeDays: number;
  };

  @Prop({
    type: {
      rentAmount: { type: Number, required: true, min: 0 },
      rentDueDay: { type: Number, required: true, min: 1, max: 31 },
      paymentFrequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        default: 'monthly',
      },
      lateFeeType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'percentage',
      },
      lateFeeValue: { type: Number, default: 5 },
      gracePeriodDays: { type: Number, default: 5 },
      securityDeposit: { type: Number, required: true },
      depositPaid: { type: Boolean, default: false },
    },
    required: true,
  })
  terms: {
    rentAmount: number;
    rentDueDay: number;
    paymentFrequency: 'monthly' | 'quarterly' | 'yearly';
    lateFeeType: 'fixed' | 'percentage';
    lateFeeValue: number;
    gracePeriodDays: number;
    securityDeposit: number;
    depositPaid: boolean;
  };

  @Prop({
    type: {
      waterRate: { type: Number, min: 0, default: 0 },
      electricityRate: { type: Number, min: 0, default: 0 },
      garbageFee: { type: Number, min: 0, default: 0 },
      securityFee: { type: Number, min: 0, default: 0 },
    },
    default: {},
  })
  utilities: {
    waterRate?: number;
    electricityRate?: number;
    garbageFee?: number;
    securityFee?: number;
  };

  @Prop({
    type: String,
    enum: ['draft', 'active', 'expired', 'terminated', 'pending'],
    default: 'draft'

  })
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'pending';

  @Prop({
    type: {
      reason: String,
      date: Date,
      approvedBy: { type: Types.ObjectId, ref: 'User' },
      fees: Number,
    },
    default: {},
  })
  termination: {
    reason?: string;
    date?: Date;
    approvedBy?: Types.ObjectId;
    fees?: number;
  };

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const LeaseSchema = SchemaFactory.createForClass(Lease);