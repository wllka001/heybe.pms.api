import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class RenewLeaseDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rentAmount?: number;
}
