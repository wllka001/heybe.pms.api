import { PartialType } from '@nestjs/swagger';
import { CreateUtilityUsageDto } from './create-utility-usage.dto';

export class UpdateUtilityUsageDto extends PartialType(CreateUtilityUsageDto) {}

