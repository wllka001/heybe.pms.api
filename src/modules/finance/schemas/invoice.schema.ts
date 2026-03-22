import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({ timestamps: true, collection: 'invoices' })
export class Invoice {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  invoiceNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Lease', required: true })
  leaseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Building', required: true })
  buildingId: Types.ObjectId;

  @Prop({
    type: {
      month: { type: Number, required: true },
      year: { type: Number, required: true },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      dueDate: { type: Date, required: true },
    },
    required: true,
  })
  period: {
    month: number;
    year: number;
    startDate: Date;
    endDate: Date;
    dueDate: Date;
  };

  @Prop({
    type: {
      rent: {
        amount: { type: Number, required: true },
        paidAmount: { type: Number, default: 0 },
      },
      utilities: [
        {
          type: String,
          description: String,
          consumption: Number,
          rate: Number,
          amount: Number,
          tax: Number,
          total: Number,
          readingId: { type: Types.ObjectId, ref: 'UtilityReading' },
          paidAmount: { type: Number, default: 0 },
        },
      ],
      additionalCharges: [
        {
          description: String,
          amount: Number,
          tax: Number,
          total: Number,
          type: {
            type: String,
            enum: ['late_fee', 'maintenance', 'damage', 'other'],
          },
          paidAmount: { type: Number, default: 0 },
        },
      ],
    },
    required: true,
  })
  items: Record<string, unknown>;

  @Prop({
    type: {
      rentSubtotal: { type: Number, required: true },
      utilitiesSubtotal: { type: Number, required: true },
      additionalSubtotal: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      taxTotal: { type: Number, required: true },
      totalAmount: { type: Number, required: true },
      currency: { type: String, enum: ['USD'], default: 'USD' },
    },
    required: true,
  })
  summary: {
    rentSubtotal: number;
    utilitiesSubtotal: number;
    additionalSubtotal: number;
    subtotal: number;
    taxTotal: number;
    totalAmount: number;
    currency: 'USD';
  };

  @Prop({
    type: String,
    enum: ['draft', 'pending', 'paid', 'partially_paid', 'overdue', 'cancelled'],
    default: 'draft',

  })
  status: 'draft' | 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';

  @Prop({ type: Number, default: 0 })
  paidAmount: number;

  @Prop({ type: Number, default: 0 })
  balance: number;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({
    type: {
      applied: { type: Boolean, default: false },
      daysLate: Number,
      feeAmount: Number,
      waived: { type: Boolean, default: false },
      waivedBy: { type: Types.ObjectId, ref: 'User' },
      waivedReason: String,
    },
    default: {},
  })
  lateFee: Record<string, unknown>;

  @Prop({
    type: [
      {
        paymentId: { type: Types.ObjectId, ref: 'Payment' },
        amount: Number,
        date: Date,
        allocation: [
          {
            itemType: { type: String, enum: ['rent', 'utility', 'additional'] },
            itemIndex: Number,
            amount: Number,
          },
        ],
      },
    ],
    default: [],
  })
  paymentHistory: Array<Record<string, unknown>>;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
