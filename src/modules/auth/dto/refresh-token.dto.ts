import { IsMongoId, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsMongoId()
  organizationId: string;

  @IsMongoId()
  userId: string;

  @IsString()
  refreshToken: string;
}
