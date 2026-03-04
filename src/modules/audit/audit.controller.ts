import { Controller, Get, Query, Req } from '@nestjs/common';
import { ListAuditDto } from './dto/list-audit.dto';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  listLogs(@Req() req: any, @Query() query: ListAuditDto) {
    return this.auditService.list(req.user.organizationId, query);
  }
}
