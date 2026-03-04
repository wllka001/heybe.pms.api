import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class OrganizationMiddleware implements NestMiddleware {
  use(req: Request & { organizationId?: string }, _res: Response, next: NextFunction) {
    const organizationId = req.headers['x-organization-id'];
    if (typeof organizationId === 'string') {
      req.organizationId = organizationId;
    }
    next();
  }
}
