import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@/common/constants/roles.enum';

export class CreateUserDto {
  @IsMongoId()
  organizationId: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsArray()
  permissions?: string[];

  @IsOptional()
  @IsArray()
  accessibleBuildings?: string[];


  @IsString()
  status?: string;
}
