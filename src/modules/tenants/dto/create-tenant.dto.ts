import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class EmergencyContactDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export enum Gender {
  male = 'male',
  female = 'female',
}
class PersonalInfoDto {
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  nationality?: string;
}
class ContactInfoDto {
  @IsString()
  primaryPhone: string;

  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;
}

export class CreateTenantDto {
  @IsMongoId()
  buildingId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo: PersonalInfoDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ContactInfoDto)
  contact: ContactInfoDto;

  @IsOptional()
  @IsString()
  nationalIdNumber?: string;

  @IsOptional()
  @IsString()
  passportNumber?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsDateString()
  verifiedAt?: Date;

  @IsOptional()
  @IsMongoId()
  verifiedBy?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'inactive' | 'blacklisted' | 'prospective';
}
