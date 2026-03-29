import { IsEmail, IsString } from 'class-validator';

export class ResendLoginOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  challengeId: string;
}
