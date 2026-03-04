import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PayrollDocument = HydratedDocument<Payroll>;

@Schema({ timestamps: true, collection: 'payrolls' })
export class Payroll {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  payrollNumber: string;

  @Prop({
    type: {
      month: { type: Number, required: true },
      year: { type: Number, required: true },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      paymentDate: { type: Date, required: true },
    },
    required: true,
  })
  period: {
    month: number;
    year: number;
    startDate: Date;
    endDate: Date;
    paymentDate: Date;
  };

  @Prop({
    type: [
      {
        employeeId: { type: Types.ObjectId, ref: 'Employee', required: true },
        earnings: {
          basicSalary: { type: Number, required: true },
          allowances: { type: Number, default: 0 },
          overtime: { type: Number, default: 0 },
          bonus: { type: Number, default: 0 },
          totalEarnings: { type: Number, required: true },
        },
        deductions: {
          tax: { type: Number, default: 0 },
          loans: { type: Number, default: 0 },
          other: { type: Number, default: 0 },
          totalDeductions: { type: Number, required: true },
        },
        netPay: { type: Number, required: true },
        payment: {
          status: {
            type: String,
            enum: ['pending', 'paid', 'failed'],
            default: 'pending',
          },
          method: {
            type: String,
            enum: ['bank_transfer', 'cash', 'cheque'],
            default: 'bank_transfer',
          },
          transactionId: String,
          paidAt: Date,
        },
      },
    ],
    default: [],
  })
  employees: Array<Record<string, unknown>>;

  @Prop({
    type: {
      totalGrossPay: { type: Number, required: true },
      totalDeductions: { type: Number, required: true },
      totalNetPay: { type: Number, required: true },
      totalEmployees: { type: Number, required: true },
    },
    required: true,
  })
  summary: {
    totalGrossPay: number;
    totalDeductions: number;
    totalNetPay: number;
    totalEmployees: number;
  };

  @Prop({
    type: String,
    enum: ['draft', 'approved', 'processing', 'completed', 'cancelled'],
    default: 'draft'
  })
  status: 'draft' | 'approved' | 'processing' | 'completed' | 'cancelled';

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const PayrollSchema = SchemaFactory.createForClass(Payroll);