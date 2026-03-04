import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrganizationDocument = Organization & Document;

@Schema({ timestamps: true, collection: 'organizations' })
export class Organization {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  registrationNumber: string;

  @Prop({ required: true, unique: true, trim: true })
  taxNumber: string;

  @Prop({ trim: true })
  logo?: string;

  @Prop({ required: true, trim: true, default: 'BLD' })
  buildingCodePrefix: string;

  @Prop({ required: true, min: 1, default: 4 })
  buildingCodeLength: number;

  @Prop({
    type: {
      street: { type: String, required: true },
      district: String,
      city: { type: String, required: true },
      region: String,
      country: { type: String, default: 'Somalia' },
      postalCode: String,
    },
    required: true,
  })
  address: {
    street: string;
    district?: string;
    city: string;
    region?: string;
    country: string;
    postalCode?: string;
  };

  @Prop({
    type: {
      primaryEmail: { type: String, required: true },
      primaryPhone: { type: String, required: true },
      secondaryEmail: String,
      secondaryPhone: String,
      website: String,
    },
    required: true,
  })
  contact: {
    primaryEmail: string;
    primaryPhone: string;
    secondaryEmail?: string;
    secondaryPhone?: string;
    website?: string;
  };

  @Prop({
    type: {
      baseCurrency: { type: String, enum: ['USD'], default: 'USD' },
      allowedCurrencies: {
        type: [String],
        enum: ['USD'],
        default: ['USD'],
      },
      vatRate: { type: Number, min: 0, default: 0 },
      lateFeeType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'percentage',
      },
      lateFeeValue: { type: Number, min: 0, default: 5 },
      gracePeriodDays: { type: Number, min: 0, default: 5 },
      invoiceDueDays: { type: Number, min: 1, default: 5 },
      rentDueDay: { type: Number, min: 1, max: 31, default: 1 },
    },
    default: {},
  })
  settings: {
    baseCurrency: 'USD';
    allowedCurrencies: Array<'USD'>;
    vatRate: number;
    lateFeeType: 'fixed' | 'percentage';
    lateFeeValue: number;
    gracePeriodDays: number;
    invoiceDueDays: number;
    rentDueDay: number;
  };

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
  updatedAt: Date;
  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
