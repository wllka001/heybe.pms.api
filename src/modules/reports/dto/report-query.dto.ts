import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  billingMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  billingYear?: number;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsMongoId()
  leaseId?: string;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;

  @IsOptional()
  @IsMongoId()
  unitId?: string;

  @IsOptional()
  @IsMongoId()
  buildingId?: string;
}
