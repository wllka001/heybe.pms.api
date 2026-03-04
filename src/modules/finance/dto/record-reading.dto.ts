import {
  IsDateString,
  IsEnum,
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

  @IsEnum(['water', 'electricity', 'gas'])
  utilityType: 'water' | 'electricity' | 'gas';

  @IsNumber()
  previousValue: number;

  @IsDateString()
  previousDate: string;

  @IsNumber()
  currentValue: number;

  @IsDateString()
  currentDate: string;

  @IsNumber()
  ratePerUnit: number;

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
