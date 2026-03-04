import { IsMongoId, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateUtilityUsageDto {
  @IsMongoId()
  leaseId: string;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waterUsed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  electricityUsed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gasUsed?: number;
}

