import { IsEmail, IsEnum, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@/common/constants/roles.enum';

export class RegisterDto {
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

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  registrationToken?: string;
}
