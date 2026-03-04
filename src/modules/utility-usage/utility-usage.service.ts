import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lease, LeaseDocument } from '@/modules/leases/schemas/lease.schema';
import { CreateUtilityUsageDto } from './dto/create-utility-usage.dto';
import { SearchUtilityUsageDto } from './dto/search-utility-usage.dto';
import { UpdateUtilityUsageDto } from './dto/update-utility-usage.dto';
import { UtilityUsage, UtilityUsageDocument } from './schemas/utility-usage.schema';

@Injectable()
export class UtilityUsageService {
  constructor(
    @InjectModel(UtilityUsage.name)
    private readonly utilityUsageModel: Model<UtilityUsageDocument>,
    @InjectModel(Lease.name)
    private readonly leaseModel: Model<LeaseDocument>,
  ) {}

  async create(
    organizationId: string,
    dto: CreateUtilityUsageDto,
    userId?: string,
  ): Promise<UtilityUsageDocument> {
    await this.ensureLeaseExists(organizationId, dto.leaseId);

    const exists = await this.utilityUsageModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      leaseId: new Types.ObjectId(dto.leaseId),
      month: dto.month,
      deletedAt: null,
    });
    if (exists) {
      throw new ConflictException('Utility usage already exists for this lease/month.');
    }

    return this.utilityUsageModel.create({
      organizationId: new Types.ObjectId(organizationId),
      leaseId: new Types.ObjectId(dto.leaseId),
      month: dto.month,
      waterUsed: dto.waterUsed ?? 0,
      electricityUsed: dto.electricityUsed ?? 0,
      gasUsed: dto.gasUsed ?? 0,
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
      deletedAt: null,
    });
  }

  async findAll(organizationId: string, query: SearchUtilityUsageDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };
    if (query.leaseId) {
      filter.leaseId = new Types.ObjectId(query.leaseId);
    }
    if (query.month) {
      filter.month = query.month;
    }

    const [data, total] = await Promise.all([
      this.utilityUsageModel
        .find(filter)
        .populate('leaseId', 'leaseNumber tenantId buildingId unitId status')
        .sort({ month: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.utilityUsageModel.countDocuments(filter),
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

  async findOne(organizationId: string, id: string): Promise<UtilityUsageDocument> {
    const usage = await this.utilityUsageModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });
    if (!usage) {
      throw new NotFoundException('Utility usage not found.');
    }
    return usage;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateUtilityUsageDto,
  ): Promise<UtilityUsageDocument> {
    const current = await this.findOne(organizationId, id);
    const leaseId = dto.leaseId ?? current.leaseId.toString();
    const month = dto.month ?? current.month;

    await this.ensureLeaseExists(organizationId, leaseId);

    const duplicate = await this.utilityUsageModel.findOne({
      _id: { $ne: current._id },
      organizationId: new Types.ObjectId(organizationId),
      leaseId: new Types.ObjectId(leaseId),
      month,
      deletedAt: null,
    });
    if (duplicate) {
      throw new ConflictException('Utility usage already exists for this lease/month.');
    }

    const payload: Record<string, unknown> = { ...dto };
    if (dto.leaseId) {
      payload.leaseId = new Types.ObjectId(dto.leaseId);
    }

    const updated = await this.utilityUsageModel.findOneAndUpdate(
      {
        _id: current._id,
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      payload,
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Utility usage not found.');
    }
    return updated;
  }

  async remove(organizationId: string, id: string): Promise<UtilityUsageDocument> {
    const deleted = await this.utilityUsageModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      { deletedAt: new Date() },
      { new: true },
    );
    if (!deleted) {
      throw new NotFoundException('Utility usage not found.');
    }
    return deleted;
  }

  private async ensureLeaseExists(organizationId: string, leaseId: string): Promise<void> {
    const exists = await this.leaseModel.findOne({
      _id: new Types.ObjectId(leaseId),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });
    if (!exists) {
      throw new NotFoundException('Lease not found for utility usage.');
    }
  }
}

