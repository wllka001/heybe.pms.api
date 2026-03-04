import { IsBoolean } from 'class-validator';

export class VerifyTenantDocumentDto {
  @IsBoolean()
  isVerified: boolean;
}

