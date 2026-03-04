import { IsMongoId, IsOptional } from 'class-validator';

export class OccupancyReportDto {
  @IsOptional()
  @IsMongoId()
  buildingId?: string;
}
