import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../modules/users/users.service';
import { FIRST_USER_BOOTSTRAP_KEY } from '../decorators/first-user-bootstrap.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userPermissions: string[] = request.user?.permissions ?? [];

    const isFirstUserBootstrap = this.reflector.getAllAndOverride<boolean>(
      FIRST_USER_BOOTSTRAP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isFirstUserBootstrap && !request.user) {
      const hasUsers = await this.usersService.hasAnyActiveUser();
      if (!hasUsers) {
        return true;
      }
    }

    if (userPermissions.includes('*')) {
      return true;
    }

    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }
}
