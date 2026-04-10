import { IsEmail, IsMongoId, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // @IsMongoId()
  // organizationId: string;

  @IsString()
  identifier: string;

  @IsString()
  @MinLength(8)
  password: string;
}
