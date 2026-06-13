import {
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  street: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsString()
  city: string;

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

class ContactDto {
  @IsEmail()
  primaryEmail: string;

  @IsString()
  primaryPhone: string;

  @IsOptional()
  @IsEmail()
  secondaryEmail?: string;

  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @IsOptional()
  @IsString()
  website?: string;
}

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsString()
  registrationNumber: string;

  @IsString()
  taxNumber: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  buildingCodePrefix?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  buildingCodeLength?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;

  @IsOptional()
  @IsObject()
  settings?: {
    vatRate?: number;
    lateFeeType?: 'fixed' | 'percentage';
    lateFeeValue?: number;
    gracePeriodDays?: number;
    invoiceDueDays?: number;
    rentDueDay?: number;
    depositReceiptToggle?: boolean;
  };

  @IsOptional()
  isActive?: boolean;
}
