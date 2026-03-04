import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TenantFileDocument = HydratedDocument<TenantFile>;

@Schema({ timestamps: true, collection: 'tenant_documents' })
export class TenantFile {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['PASSPORT', 'NATIONAL_ID', 'CONTRACT_COPY', 'OTHER'],
    required: true,
  })
  documentType: 'PASSPORT' | 'NATIONAL_ID' | 'CONTRACT_COPY' | 'OTHER';

  @Prop({ type: String, required: true })
  documentUrl: string;

  @Prop({ type: String })
  originalName?: string;

  @Prop({ type: String })
  mimeType?: string;

  @Prop({ type: Number, min: 0 })
  size?: number;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Employee' })
  verifiedBy?: Types.ObjectId;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Employee' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const TenantFileSchema = SchemaFactory.createForClass(TenantFile);
TenantFileSchema.index({ organizationId: 1, tenantId: 1, documentType: 1, createdAt: -1 });
