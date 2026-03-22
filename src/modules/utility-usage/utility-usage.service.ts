import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUtilityUsageDto } from './dto/create-utility-usage.dto';
import { SearchUtilityUsageDto } from './dto/search-utility-usage.dto';
import { UpdateUtilityUsageDto } from './dto/update-utility-usage.dto';
import { UtilityUsage, UtilityUsageDocument } from './schemas/utility-usage.schema';

@Injectable()
export class UtilityUsageService {
  constructor(
    @InjectModel(UtilityUsage.name)
    private readonly utilityUsageModel: Model<UtilityUsageDocument>,
  ) {}

  async create(
    organizationId: string,
    dto: CreateUtilityUsageDto,
    userId?: string,
  ): Promise<UtilityUsageDocument> {
    const normalizedCode = this.normalizeCode(dto.code || dto.name);

    const exists = await this.utilityUsageModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      code: normalizedCode,
      deletedAt: null,
    });
    if (exists) {
      throw new ConflictException('Utility type code already exists.');
    }

    return this.utilityUsageModel.create({
      organizationId: new Types.ObjectId(organizationId),
      name: dto.name.trim(),
      code: normalizedCode,
      description: dto.description?.trim() || undefined,
      inputConfig: {
        hasPreviousValue: Boolean(dto.inputConfig?.hasPreviousValue),
        hasCurrentValue: Boolean(dto.inputConfig?.hasCurrentValue),
        hasRatePerUnit: Boolean(dto.inputConfig?.hasRatePerUnit),
        hasPreviousDate: Boolean(dto.inputConfig?.hasPreviousDate),
        hasCurrentDate: Boolean(dto.inputConfig?.hasCurrentDate),
        hasFixedMonthlyAmount: Boolean(dto.inputConfig?.hasFixedMonthlyAmount),
      },
      defaults: {
        ratePerUnit: Number(dto.defaults?.ratePerUnit ?? 0),
        fixedMonthlyAmount: Number(dto.defaults?.fixedMonthlyAmount ?? 0),
        taxRate: Number(dto.defaults?.taxRate ?? 0),
        unitLabel: dto.defaults?.unitLabel?.trim() || '',
      },
      isActive: dto.isActive ?? true,
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
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }
    if (query.q) {
      filter.$or = [
        { name: { $regex: query.q, $options: 'i' } },
        { code: { $regex: query.q, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.utilityUsageModel
        .find(filter)
        .sort({ createdAt: -1 })
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
    const utilityType = await this.utilityUsageModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });
    if (!utilityType) {
      throw new NotFoundException('Utility type not found.');
    }
    return utilityType;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateUtilityUsageDto,
  ): Promise<UtilityUsageDocument> {
    const current = await this.findOne(organizationId, id);
    const nextCode = this.normalizeCode(dto.code || dto.name || current.code);

    const duplicate = await this.utilityUsageModel.findOne({
      _id: { $ne: current._id },
      organizationId: new Types.ObjectId(organizationId),
      code: nextCode,
      deletedAt: null,
    });
    if (duplicate) {
      throw new ConflictException('Utility type code already exists.');
    }

    const payload: Record<string, unknown> = {
      ...dto,
      code: nextCode,
    };

    if (dto.name !== undefined) {
      payload.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      payload.description = dto.description?.trim() || undefined;
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
      throw new NotFoundException('Utility type not found.');
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
      { deletedAt: new Date(), isActive: false },
      { new: true },
    );
    if (!deleted) {
      throw new NotFoundException('Utility type not found.');
    }
    return deleted;
  }

  private normalizeCode(code: string): string {
    return code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
