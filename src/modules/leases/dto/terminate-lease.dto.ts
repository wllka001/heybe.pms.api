import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TerminateLeaseDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fees?: number;
}
