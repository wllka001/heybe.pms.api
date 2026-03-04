import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateUnitDto {
  @IsMongoId()
  buildingId: string;

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
