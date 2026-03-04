import { IsMongoId, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class SearchUtilityUsageDto extends PaginationDto {
  @IsOptional()
  @IsMongoId()
  leaseId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}

