import { IsEnum, IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsEnum(['recorded', 'verified', 'reconciled', 'rejected', 'reversed'])
  status: 'recorded' | 'verified' | 'reconciled' | 'rejected' | 'reversed';

  @IsOptional()
  @IsString()
  note?: string;
}
