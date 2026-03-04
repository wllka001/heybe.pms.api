import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'on_hold'])
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';

  @IsOptional()
  @IsString()
  notes?: string;
}

