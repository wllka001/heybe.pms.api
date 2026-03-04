import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EmployeeDocument = HydratedDocument<Employee>;

@Schema({ timestamps: true, collection: 'employees' })
export class Employee {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  employeeCode: string;

  @Prop({ type: Types.ObjectId, ref: 'Building' })
  primaryBuildingId?: Types.ObjectId;

  @Prop({
    type: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      idNumber: { type: String, required: true },
      gender: { type: String, enum: ['male', 'female'] },
      dateOfBirth: Date,
    },
    required: true,
  })
  personalInfo: Record<string, unknown>;

  @Prop({
    type: {
      primaryPhone: { type: String, required: true },
      secondaryPhone: String,
      email: { type: String, required: true },
    },
    required: true,
  })
  contact: Record<string, unknown>;

  @Prop({
    type: {
      position: { type: String, required: true },
      department: {
        type: String,
        enum: ['management', 'maintenance', 'security', 'cleaning', 'accounting', 'admin'],
      },
      startDate: { type: Date, required: true },
      employmentType: {
        type: String,
        enum: ['permanent', 'contract', 'intern', 'casual'],
        default: 'permanent',
      },
      role: {
        type: String,
        enum: ['admin', 'manager', 'accountant', 'maintenance', 'security', 'reception'],
        required: true,
      },
    },
    required: true,
  })
  employment: Record<string, unknown>;

  @Prop({
    type: {
      amount: { type: Number, required: true },
      frequency: {
        type: String,
        enum: ['monthly', 'biweekly', 'weekly'],
        default: 'monthly',
      },
      bankAccount: {
        bankName: String,
        accountNumber: String,
        branch: String,
      },
    },
    required: true,
  })
  salary: Record<string, unknown>;

  @Prop({
    type: String,
    enum: ['active', 'inactive', 'on_leave', 'terminated'],
    default: 'active',

  })
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);