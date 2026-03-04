import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MaintenanceRequestDocument = HydratedDocument<MaintenanceRequest>;

const MaintenanceIssueSchema = new MongooseSchema(
  {
    type: { type: String, required: true },
    subCategory: String,
    description: { type: String, required: true },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      required: true,
    },
  },
  { _id: false },
);

@Schema({ timestamps: true, collection: 'maintenance_requests' })
export class MaintenanceRequest {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  requestNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Building', required: true })
  buildingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant' })
  tenantId?: Types.ObjectId;

  @Prop({ type: MaintenanceIssueSchema, required: true })
  issue: {
    type: string;
    subCategory?: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  };

  @Prop({
    type: [
      {
        url: String,
        note: String,
        type: { type: String, enum: ['image', 'video', 'document'] },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Types.ObjectId, ref: 'Employee' },
      },
    ],
    default: [],
  })
  attachments: Array<Record<string, unknown>>;

  @Prop({
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'on_hold'],
    default: 'pending'

  })
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';

  @Prop({ type: Types.ObjectId, ref: 'Employee' })
  assignedToId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendorId?: Types.ObjectId;

  @Prop({
    type: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Types.ObjectId, ref: 'Employee' },
        notes: String,
      },
    ],
    default: [],
  })
  statusHistory: Array<Record<string, unknown>>;

  @Prop({
    type: {
      estimated: Number,
      actual: Number,
      labor: Number,
      parts: Number,
      total: Number,
      approvedBy: { type: Types.ObjectId, ref: 'Employee' },
      approvedAt: Date,
    },
    default: {},
  })
  cost: Record<string, unknown>;

  @Prop({
    type: {
      responsibleParty: {
        type: String,
        enum: ['landlord', 'tenant', 'company'],
        default: 'landlord',
      },
      paidByTenant: { type: Boolean, default: false },
      amountChargedToTenant: Number,
      invoiceId: { type: Types.ObjectId, ref: 'Invoice' },
    },
    default: {},
  })
  billing: Record<string, unknown>;

  @Prop({
    type: {
      completedAt: Date,
      completedBy: { type: Types.ObjectId, ref: 'Employee' },
      notes: String,
      tenantFeedback: {
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
      },
    },
    default: {},
  })
  completion: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const MaintenanceRequestSchema =
  SchemaFactory.createForClass(MaintenanceRequest);
