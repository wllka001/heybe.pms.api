import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDepositRefundDto {
  @IsMongoId()
  tenantId: string;

  @IsMongoId()
  leaseId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  refundDate: string;

  @IsEnum(['evc', 'merchant', 'bank', 'cash'])
  method: 'evc' | 'merchant' | 'bank' | 'cash';

  @IsOptional()
  @IsString()
  notes?: string;
}
