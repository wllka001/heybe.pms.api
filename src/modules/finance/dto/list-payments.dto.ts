import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, Min } from 'class-validator';

export class ListPaymentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;

  @IsOptional()
  @IsEnum(['recorded', 'verified', 'reconciled', 'rejected', 'reversed'])
  status?: 'recorded' | 'verified' | 'reconciled' | 'rejected' | 'reversed';
}
