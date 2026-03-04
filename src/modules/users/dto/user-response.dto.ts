import { Role } from '@/common/constants/roles.enum';

export class UserResponseDto {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  permissions: string[];
  accessibleBuildings: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
