import { IsDateString, IsOptional, IsString } from 'class-validator';

export class FinanceReportDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsOptional()
  @IsString()
  buildingId?: string;
}
