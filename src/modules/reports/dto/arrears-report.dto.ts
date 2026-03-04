import { IsMongoId, IsOptional } from 'class-validator';

export class ArrearsReportDto {
  @IsOptional()
  @IsMongoId()
  buildingId?: string;
}
