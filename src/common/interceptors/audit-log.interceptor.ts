import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { AuditService } from '@/modules/audit/audit.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(async (data) => {
        if (!request.user) {
          return;
        }

        try {
          await this.auditService.createLog({
            organizationId: request.user.organizationId,
            userId: request.user.id,
            userEmail: request.user.email,
            userRole: request.user.role,
            action: request.method,
            entityType: this.extractEntityType(request.originalUrl),
            entityId: data?._id,
            data,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        } catch {
          // Audit write failures must not break business responses.
        }
      }),
    );
  }

  private extractEntityType(path: string): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) {
      return 'unknown';
    }

    if (parts[0] === 'api' && parts[1]?.startsWith('v')) {
      return parts[2] ?? 'unknown';
    }

    return parts[0] ?? 'unknown';
  }
}
