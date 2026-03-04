import { IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CompleteRequestDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  tenantFeedback?: {
    rating?: number;
    comment?: string;
  };

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCost?: number;
}
