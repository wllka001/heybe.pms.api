import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  vendorCode: string;

  @IsString()
  name: string;

  @IsEnum(['plumbing', 'electrical', 'cleaning', 'security', 'general', 'other'])
  category: string;

  @IsOptional()
  @IsArray()
  specialties?: string[];

  @IsObject()
  contact: {
    primaryPhone: string;
    secondaryPhone?: string;
    email: string;
    website?: string;
  };

  @IsOptional()
  @IsObject()
  primaryContact?: {
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
  };
}
