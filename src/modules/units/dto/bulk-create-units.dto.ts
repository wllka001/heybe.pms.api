import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class BulkCreateUnitItemDto {
  @IsOptional()
  @IsMongoId()
  buildingId?: string;

  @IsOptional()
  @IsString()
  buildingCode?: string;

  @IsNumber()
  floor: number;

  @IsEnum([
    'studio',
    '1-bedroom',
    '2-bedroom',
    '3-bedroom',
    '4-bedroom',
    'commercial',
  ])
  type: string;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, unknown>;

  @IsNumber()
  @Min(0)
  marketRent: number;

  @IsOptional()
  @IsArray()
  features?: string[];
}

export class BulkCreateUnitsDto {
  @IsOptional()
  @IsString()
  buildingCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateUnitItemDto)
  units: BulkCreateUnitItemDto[];
}
