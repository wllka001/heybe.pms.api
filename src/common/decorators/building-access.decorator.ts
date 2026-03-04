import { SetMetadata } from '@nestjs/common';

export const BUILDING_ACCESS_KEY = 'buildingAccessParam';

export const BuildingAccess = (paramName = 'buildingId') =>
  SetMetadata(BUILDING_ACCESS_KEY, paramName);
