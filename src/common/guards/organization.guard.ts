import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../modules/users/users.service';
import { Role } from '../constants/roles.enum';
import { BUILDING_ACCESS_KEY } from '../decorators/building-access.decorator';
import { FIRST_USER_BOOTSTRAP_KEY } from '../decorators/first-user-bootstrap.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const isFirstUserBootstrap = this.reflector.getAllAndOverride<boolean>(
      FIRST_USER_BOOTSTRAP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isFirstUserBootstrap) {
      const hasUsers = await this.usersService.hasAnyActiveUser();
      if (!hasUsers) {
        return true;
      }
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }

    request.organizationId = user.organizationId;

    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const buildingParamName = this.reflector.getAllAndOverride<string>(
      BUILDING_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!buildingParamName) {
      return true;
    }

    const buildingId = request.params?.[buildingParamName] ?? request.query?.[buildingParamName];
    if (!buildingId) {
      return true;
    }

    const accessibleBuildings: string[] = (user.accessibleBuildings ?? []).map(
      (id: { toString: () => string } | string) => id.toString(),
    );

    if (!accessibleBuildings.includes(buildingId.toString())) {
      throw new ForbiddenException('No access to this building.');
    }

    return true;
  }
}
