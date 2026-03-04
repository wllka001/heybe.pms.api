import { IsEnum, IsMongoId, IsOptional } from 'class-validator';

export class AssignWorkOrderDto {
  @IsOptional()
  @IsMongoId()
  assignedToId?: string;

  @IsOptional()
  @IsMongoId()
  vendorId?: string;

  @IsEnum(['assigned', 'in_progress'])
  status: 'assigned' | 'in_progress';
}
