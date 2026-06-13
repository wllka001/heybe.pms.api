import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Building', required: true })
  buildingId: Types.ObjectId;

  @Prop({ required: true })
  tenantCode: string;

  @Prop({
    type: {
      firstName: { type: String, required: true },
      middleName: String,
      lastName: { type: String, required: true },
      gender: { type: String, enum: ['male', 'female'] },
      dateOfBirth: Date,
      idNumber: { type: String },
      nationality: String,
    },
    required: true,
  })
  personalInfo: {
    firstName: string;
    middleName?: string;
    lastName: string;
    gender?: string;
    dateOfBirth?: Date;
    idNumber: string;
    nationality?: string;
  };

  @Prop({
    type: {
      primaryPhone: { type: String, required: true },
      secondaryPhone: String,
      email: { type: String, required: true },
      emergencyContact: {
        name: String,
        relationship: String,
        phone: String,
      },
    },
    required: true,
  })
  contact: Record<string, unknown>;

  @Prop({ type: String, unique: true, sparse: true, trim: true })
  nationalIdNumber?: string;

  @Prop({ type: String, sparse: true, trim: true })
  passportNumber?: string;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Employee' })
  verifiedBy?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['active', 'inactive', 'blacklisted', 'prospective'],
    default: 'prospective'

  })
  status: 'active' | 'inactive' | 'blacklisted' | 'prospective';

  @Prop({ type: Types.ObjectId, ref: 'Lease' })
  currentLeaseId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Unit' })
  currentUnitId?: Types.ObjectId;

  @Prop({
    type: [
      {
        leaseId: { type: Types.ObjectId, ref: 'Lease' },
        unitId: { type: Types.ObjectId, ref: 'Unit' },
        buildingId: { type: Types.ObjectId, ref: 'Building' },
        startDate: Date,
        endDate: Date,
      },
    ],
    default: [],
  })
  tenancyHistory: Array<Record<string, unknown>>;

  @Prop({
    type: {
      totalPaid: { type: Number, default: 0 },
      latePayments: { type: Number, default: 0 },
      lastPaymentDate: Date,
      lastPaymentAmount: Number,
      nextPaymentDue: Date,
    },
    default: {},
  })
  paymentSummary: Record<string, unknown>;

  @Prop({ type: Number, default: 0 })
  beginningBalance: number;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
TenantSchema.index({ organizationId: 1, buildingId: 1, tenantCode: 1 }, { unique: true });
TenantSchema.index({ organizationId: 1, nationalIdNumber: 1 }, { unique: true, sparse: true });
