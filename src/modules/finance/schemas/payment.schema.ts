import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export type PaymentMethod = 'evc' | 'merchant' | 'bank';

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  paymentNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lease', required: true })
  leaseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Invoice' })
  invoiceId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Building', required: true })
  buildingId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: String, enum: ['USD'], default: 'USD' })
  currency: 'USD';

  @Prop({ required: true })
  paymentDate: Date;

  @Prop({ type: String, enum: ['evc', 'merchant', 'bank'], required: true })
  method: PaymentMethod;

  @Prop({
    type: {
      evc: {
        referenceNumber: String,
        senderMsisdn: String,
        receiverMsisdn: String,
        confirmationMessage: String,
      },
      merchant: {
        referenceNumber: String,
        merchantName: String,
        merchantCode: String,
        terminalId: String,
      },
      bank: {
        bankName: String,
        accountNumber: String,
        transactionId: String,
        transferDate: Date,
        slipNumber: String,
      },
    },
    default: {},
  })
  methodDetails: Record<string, unknown>;

  @Prop({
    type: [
      {
        invoiceId: { type: Types.ObjectId, ref: 'Invoice', required: true },
        itemType: {
          type: String,
          enum: ['rent', 'utility', 'additional', 'deposit'],
          required: true,
        },
        itemIndex: { type: Number, default: 0 },
        amount: { type: Number, required: true },
      },
    ],
    default: [],
  })
  allocation: Array<Record<string, unknown>>;

  @Prop({
    type: {
      receiptNumber: { type: String, required: true },
      generatedAt: { type: Date, default: Date.now },
      sentToTenant: { type: Boolean, default: false },
      url: String,
    },
    required: true,
  })
  receipt: Record<string, unknown>;

  @Prop({
    type: {
      status: {
        type: String,
        enum: ['recorded', 'verified', 'reconciled', 'rejected', 'reversed'],
        default: 'recorded',
      },
      verifiedBy: { type: Types.ObjectId, ref: 'User' },
      verifiedAt: Date,
      reconciledBy: { type: Types.ObjectId, ref: 'User' },
      reconciledAt: Date,
      rejectedBy: { type: Types.ObjectId, ref: 'User' },
      rejectedAt: Date,
      reversedBy: { type: Types.ObjectId, ref: 'User' },
      reversedAt: Date,
      notes: String,
    },
    default: {},
  })
  lifecycle: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recordedBy: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  recordedAt: Date;

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
