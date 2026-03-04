import { IsNumber, IsOptional, Min } from 'class-validator';

export class AddCostDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  labor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  parts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimated?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actual?: number;
}

