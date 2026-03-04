import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class RentRollReportDto {
  @IsOptional()
  @IsMongoId()
  buildingId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
