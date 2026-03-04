import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class ExpenseReportDto {
  @IsOptional()
  @IsMongoId()
  buildingId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
