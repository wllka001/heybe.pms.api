import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VendorDocument = HydratedDocument<Vendor>;

@Schema({ timestamps: true, collection: 'vendors' })
export class Vendor {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  vendorCode: string;

  @Prop({ required: true })
  name: string;

  @Prop({
    type: String,
    enum: ['plumbing', 'electrical', 'cleaning', 'security', 'general', 'other'],
    required: true,
  })
  category: string;

  @Prop({ type: [String], default: [] })
  specialties: string[];

  @Prop({
    type: {
      primaryPhone: { type: String, required: true },
      secondaryPhone: String,
      email: { type: String, required: true },
      website: String,
    },
    required: true,
  })
  contact: Record<string, unknown>;

  @Prop({
    type: {
      contactPerson: String,
      contactPhone: String,
      contactEmail: String,
    },
    default: {},
  })
  primaryContact: Record<string, unknown>;

  @Prop({
    type: String,
    enum: ['active', 'inactive', 'blacklisted'],
    default: 'active'

  })
  status: 'active' | 'inactive' | 'blacklisted';

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
