import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExpenseDocument = HydratedDocument<Expense>;

@Schema({ timestamps: true, collection: 'expenses' })
export class Expense {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  expenseNumber: string;

  @Prop({
    type: String,
    enum: [
      'utilities',
      'maintenance',
      'salary',
      'tax',
      'insurance',
      'office',
      'marketing',
      'supplies',
      'security',
      'other',
    ],
    required: true,
  })
  category: string;

  @Prop()
  subCategory?: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: String, enum: ['USD'], default: 'USD' })
  currency: 'USD';

  @Prop({ type: Types.ObjectId, ref: 'Building' })
  buildingId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Unit' })
  unitId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'MaintenanceRequest' })
  maintenanceRequestId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendorId?: Types.ObjectId;

  @Prop({
    type: {
      name: { type: String, required: true },
      contact: String,
      email: String,
      taxNumber: String,
    },
    required: true,
  })
  payee: Record<string, unknown>;

  @Prop({ required: true })
  expenseDate: Date;

  @Prop({
    type: {
      method: { type: String, enum: ['evc', 'merchant', 'bank', 'cash'] },
      paid: { type: Boolean, default: false },
      paidDate: Date,
      transactionId: String,
      receiptUrl: String,
    },
    default: {},
  })
  payment: Record<string, unknown>;

  @Prop({
    type: {
      required: { type: Boolean, default: false },
      approvedBy: { type: Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
    },
    default: {},
  })
  approval: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);