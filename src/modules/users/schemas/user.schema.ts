import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Permission } from '@/common/constants/permissions.enum';
import { Role } from '@/common/constants/roles.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ type: String, enum: Object.values(Role), required: true })
  role: Role;

  @Prop({ type: [String], default: [] })
  permissions: Permission[] | string[];

  @Prop({ type: [Types.ObjectId], ref: 'Building', default: [] })
  accessibleBuildings: Types.ObjectId[];

  @Prop({ type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' })
  status: 'active' | 'inactive' | 'suspended';

  @Prop({
    type: {
      lastLoginAt: Date,
      lastLoginIp: String,
      passwordChangedAt: Date,
      refreshTokenHash: String,
      refreshTokenExpiresAt: Date,
      loginOtpHash: String,
      loginOtpExpiresAt: Date,
      loginOtpChallengeId: String,
      loginOtpLastSentAt: Date,
    },
    default: {},
  })
  security: {
    lastLoginAt?: Date;
    lastLoginIp?: string;
    passwordChangedAt?: Date;
    refreshTokenHash?: string;
    refreshTokenExpiresAt?: Date;
    loginOtpHash?: string;
    loginOtpExpiresAt?: Date;
    loginOtpChallengeId?: string;
    loginOtpLastSentAt?: Date;
  };

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
