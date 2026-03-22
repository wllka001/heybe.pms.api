import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUtilityUsageDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  inputConfig?: {
    hasPreviousValue?: boolean;
    hasCurrentValue?: boolean;
    hasRatePerUnit?: boolean;
    hasPreviousDate?: boolean;
    hasCurrentDate?: boolean;
    hasFixedMonthlyAmount?: boolean;
  };

  @IsOptional()
  @IsObject()
  defaults?: {
    ratePerUnit?: number;
    fixedMonthlyAmount?: number;
    taxRate?: number;
    unitLabel?: string;
  };

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
