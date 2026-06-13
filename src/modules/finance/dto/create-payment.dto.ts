import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AllocationDto {
  @IsOptional()
  @IsMongoId()
  invoiceId?: string;

  @IsEnum(['rent', 'utility', 'additional', 'deposit', 'beginning_balance'])
  itemType: 'rent' | 'utility' | 'additional' | 'deposit' | 'beginning_balance';

  @IsOptional()
  @IsNumber()
  @Min(0)
  itemIndex?: number;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreatePaymentDto {
  @IsMongoId()
  tenantId: string;

  @IsMongoId()
  leaseId: string;

  @IsOptional()
  @IsMongoId()
  invoiceId?: string;

  @IsMongoId()
  unitId: string;

  @IsMongoId()
  buildingId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsEnum(['evc', 'merchant', 'bank'])
  method: 'evc' | 'merchant' | 'bank';

  @IsObject()
  methodDetails: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocation?: AllocationDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
