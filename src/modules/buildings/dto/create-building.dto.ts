import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

class DetailsDto {
  @IsOptional()
  @IsNumber()
  totalFloors?: number;

  @IsOptional()
  @IsNumber()
  totalUnits?: number;

  @IsOptional()
  @IsNumber()
  yearBuilt?: number;

  @IsOptional()
  @IsNumber()
  parkingSpaces?: number;

  @IsOptional()
  @IsBoolean()
  hasGenerator?: boolean;

  @IsOptional()
  @IsBoolean()
  hasWaterTank?: boolean;

  @IsOptional()
  @IsBoolean()
  hasSecurity?: boolean;
}

export class CreateBuildingDto {
  @IsString()
  name: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsOptional()
  @IsString()
  unitCodePrefix?: string;

  @IsOptional()
  @IsNumber()
  unitCodeLength?: number;

  @IsOptional()
  @IsString()
  tenantCodePrefix?: string;

  @IsOptional()
  @IsNumber()
  tenantCodeLength?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DetailsDto)
  details?: DetailsDto;

  @IsOptional()
  @IsArray()
  amenities?: string[];

  @IsBoolean()
  @Type(() => Boolean)
  isActive: boolean;
}
