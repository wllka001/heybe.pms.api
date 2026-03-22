import {
  IsArray,
  IsDateString,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class UtilityChargeDto {
  @IsString()
  type: 'water' | 'electricity' | 'gas' | 'garbage' | 'security';

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumption?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;
}

class AdditionalChargeDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;
}

export class CreateInvoiceDto {
  @IsMongoId()
  leaseId: string;

  @IsInt()
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rentAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UtilityChargeDto)
  utilities?: UtilityChargeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalChargeDto)
  additionalCharges?: AdditionalChargeDto[];
}
