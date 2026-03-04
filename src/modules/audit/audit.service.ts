import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ListAuditDto } from './dto/list-audit.dto';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async createLog(payload: {
    organizationId: string;
    userId: string;
    userEmail?: string;
    userRole?: string;
    action: string;
    entityType: string;
    entityId?: unknown;
    changes?: Record<string, unknown>;
    data?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogDocument> {
    return this.auditLogModel.create({
      organizationId: new Types.ObjectId(payload.organizationId),
      userId: new Types.ObjectId(payload.userId),
      userEmail: payload.userEmail,
      userRole: payload.userRole,
      action: payload.action,
      entityType: payload.entityType,
      entityId:
        typeof payload.entityId === 'string' && Types.ObjectId.isValid(payload.entityId)
          ? new Types.ObjectId(payload.entityId)
          : undefined,
      changes: payload.changes,
      data: payload.data,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      metadata: payload.metadata,
      timestamp: new Date(),
    });
  }

  async list(organizationId: string, query: ListAuditDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
    };

    if (query.action) {
      filter.action = query.action;
    }

    if (query.entityType) {
      filter.entityType = query.entityType;
    }

    if (query.userId && Types.ObjectId.isValid(query.userId)) {
      filter.userId = new Types.ObjectId(query.userId);
    }

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }
}
