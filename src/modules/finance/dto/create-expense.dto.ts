import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  expenseNumber?: string;

  @IsEnum([
    'utilities',
    'maintenance',
    'salary',
    'tax',
    'insurance',
    'office',
    'marketing',
    'supplies',
    'security',
    'other',
  ])
  category: string;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsMongoId()
  buildingId?: string;

  @IsOptional()
  @IsMongoId()
  unitId?: string;

  @IsOptional()
  @IsMongoId()
  maintenanceRequestId?: string;

  @IsOptional()
  @IsMongoId()
  vendorId?: string;

  @IsObject()
  payee: {
    name: string;
    contact?: string;
    email?: string;
    taxNumber?: string;
  };

  @IsDateString()
  expenseDate: string;

  @IsOptional()
  @IsObject()
  payment?: {
    method?: 'evc' | 'merchant' | 'bank' | 'cash';
    paid?: boolean;
    paidDate?: string;
    transactionId?: string;
    receiptUrl?: string;
  };

  @IsOptional()
  @IsObject()
  approval?: {
    required?: boolean;
  };
}
