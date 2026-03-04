import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateTenantDocumentDto {
  @IsEnum(['PASSPORT', 'NATIONAL_ID', 'CONTRACT_COPY', 'OTHER'])
  documentType: 'PASSPORT' | 'NATIONAL_ID' | 'CONTRACT_COPY' | 'OTHER';

  @IsOptional()
  @IsString()
  note?: string;
}

