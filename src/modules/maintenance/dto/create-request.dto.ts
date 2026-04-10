import {
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateRequestDto {
  @IsOptional()
  @IsString()
  requestNumber?: string;

  @IsMongoId()
  buildingId: string;

  @IsMongoId()
  unitId: string;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;

  @IsObject()
  issue: {
    type: string;
    subCategory?: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  };

  @IsOptional()
  @IsEnum(['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'on_hold'])
  status?: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';

  @IsOptional()
  @IsMongoId()
  assignedToId?: string;

  @IsOptional()
  @IsMongoId()
  vendorId?: string;

  @IsOptional()
  @IsObject()
  cost?: {
    estimated?: number;
    actual?: number;
    labor?: number;
    parts?: number;
    total?: number;
  };

  @IsOptional()
  @IsObject()
  billing?: {
    responsibleParty?: 'landlord' | 'tenant' | 'company';
    paidByTenant?: boolean;
    amountChargedToTenant?: number;
    invoiceId?: string;
  };

  @IsOptional()
  @IsObject()
  completion?: {
    notes?: string;
    tenantFeedback?: {
      rating?: number;
      comment?: string;
    };
  };
}
