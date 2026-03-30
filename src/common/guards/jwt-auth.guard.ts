import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isObservable, lastValueFrom, Observable } from 'rxjs';
import { UsersService } from '../../modules/users/users.service';
import { FIRST_USER_BOOTSTRAP_KEY } from '../decorators/first-user-bootstrap.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {
    super();
  }

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

    return this.resolveCanActivateResult(super.canActivate(context));
  }

  private async resolveCanActivateResult(
    result: boolean | Promise<boolean> | Observable<boolean>,
  ): Promise<boolean> {
    if (typeof result === 'boolean') {
      return result;
    }
    if (isObservable(result)) {
      return lastValueFrom(result);
    }
    return result;
  }
}
