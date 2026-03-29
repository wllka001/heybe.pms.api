import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyLoginOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  challengeId: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}
