import { IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(['evc', 'merchant', 'bank'])
  method?: 'evc' | 'merchant' | 'bank';

  @IsOptional()
  @IsObject()
  methodDetails?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;
}
