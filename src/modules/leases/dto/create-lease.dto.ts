import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateLeaseDto {
  @IsOptional()
  @IsString()
  leaseNumber?: string;

  @IsMongoId()
  tenantId: string;

  @IsMongoId()
  buildingId: string;

  @IsMongoId()
  unitId: string;

  @IsObject()
  period: {
    startDate: Date;
    endDate: Date;
    duration: number;
    isAutoRenew?: boolean;
    renewalNoticeDays?: number;
  };

  @IsObject()
  terms: {
    rentAmount: number;
    rentDueDay: number;
    paymentFrequency?: 'monthly' | 'quarterly' | 'yearly';
    lateFeeType?: 'fixed' | 'percentage';
    lateFeeValue?: number;
    gracePeriodDays?: number;
    securityDeposit: number;
    depositPaid?: boolean;
  };

  @IsOptional()
  @IsObject()
  utilities?: {
    waterRate?: number;
    electricityRate?: number;
    garbageFee?: number;
    securityFee?: number;
  };

  @IsOptional()
  @IsEnum(['draft', 'active', 'pending'])
  status?: 'draft' | 'active' | 'pending';
}
