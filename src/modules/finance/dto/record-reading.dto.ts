import {
  IsDateString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RecordReadingDto {
  @IsMongoId()
  buildingId: string;

  @IsMongoId()
  unitId: string;

  @IsMongoId()
  leaseId: string;

  @IsMongoId()
  utilityTypeId: string;

  @IsOptional()
  @IsNumber()
  previousValue?: number;

  @IsOptional()
  @IsDateString()
  previousDate?: string;

  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @IsOptional()
  @IsDateString()
  currentDate?: string;

  @IsOptional()
  @IsNumber()
  ratePerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  billingMonth: number;

  @IsNumber()
  billingYear: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
