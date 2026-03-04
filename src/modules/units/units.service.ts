import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  formatSequentialCode,
  getNextSequentialNumber,
} from '@/common/utils/generate-code.utils';
import { Building, BuildingDocument } from '@/modules/buildings/schemas/building.schema';
import { Lease, LeaseDocument } from '@/modules/leases/schemas/lease.schema';
import { CreateUnitDto } from './dto/create-unit.dto';
import { BulkCreateUnitsDto } from './dto/bulk-create-units.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Unit, UnitDocument } from './schemas/unit.schema';

@Injectable()
export class UnitsService {
  constructor(
    @InjectModel(Unit.name)
    private readonly unitModel: Model<UnitDocument>,
    @InjectModel(Building.name)
    private readonly buildingModel: Model<BuildingDocument>,
    @InjectModel(Lease.name)
    private readonly leaseModel: Model<LeaseDocument>,
  ) { }

  async create(organizationId: string, dto: CreateUnitDto): Promise<UnitDocument> {
    const organizationObjectId = new Types.ObjectId(organizationId);
    const building = await this.buildingModel.findOne({
      _id: new Types.ObjectId(dto.buildingId),
      organizationId: organizationObjectId,
      deletedAt: null,
    });

    if (!building) {
      throw new NotFoundException('Building not found.');
    }

    await this.assertBuildingCapacity(building, dto.floor, organizationObjectId);

    const nextUnitIdentifiers = await this.generateNextUnitIdentifiers(organizationObjectId, building);

    return this.unitModel.create({
      ...dto,
      code: nextUnitIdentifiers.code,
      unitNumber: nextUnitIdentifiers.unitNumber,
      organizationId: new Types.ObjectId(organizationId),
      buildingId: new Types.ObjectId(dto.buildingId),
      isActive: true,
      status: 'vacant',
    });
  }

  async bulkCreate(organizationId: string, dto: BulkCreateUnitsDto) {
    const organizationObjectId = new Types.ObjectId(organizationId);
    const buildingCache = new Map<string, BuildingDocument>();
    const stateByBuilding = new Map<
      string,
      { building: BuildingDocument; existingCount: number; nextSequence: number }
    >();
    const created: UnitDocument[] = [];
    const skipped: Array<Record<string, unknown>> = [];

    for (const unit of dto.units) {
      const building = await this.resolveBuildingForBulkUnit(
        organizationObjectId,
        unit.buildingId,
        unit.buildingCode ?? dto.buildingCode,
        buildingCache,
      );

      const buildingState = await this.getBulkBuildingState(
        organizationObjectId,
        building,
        stateByBuilding,
      );
      const constraints = this.getBuildingConstraints(building);
      const attemptedTotal = buildingState.existingCount + created.filter(
        (entry) => entry.buildingId.toString() === building._id.toString(),
      ).length;

      if (constraints.totalFloors !== undefined && unit.floor > constraints.totalFloors) {
        skipped.push({
          buildingId: building._id.toString(),
          buildingCode: building.code,
          floor: unit.floor,
          type: unit.type,
          marketRent: unit.marketRent,
          reason: `Floor ${unit.floor} exceeds building total floors ${constraints.totalFloors}.`,
        });
        continue;
      }

      if (constraints.totalUnits !== undefined && attemptedTotal >= constraints.totalUnits) {
        skipped.push({
          buildingId: building._id.toString(),
          buildingCode: building.code,
          floor: unit.floor,
          type: unit.type,
          marketRent: unit.marketRent,
          reason: `Building unit limit exceeded. Capacity is ${constraints.totalUnits}.`,
        });
        continue;
      }

      const identifiers = this.buildUnitIdentifiers(building, buildingState.nextSequence);
      const unitDocument = await this.unitModel.create({
        buildingId: building._id,
        organizationId: organizationObjectId,
        code: identifiers.code,
        unitNumber: identifiers.unitNumber,
        floor: unit.floor,
        type: unit.type,
        specifications: unit.specifications,
        marketRent: unit.marketRent,
        features: unit.features,
        isActive: true,
        status: 'vacant',
      });

      buildingState.nextSequence += 1;
      created.push(unitDocument);
    }

    return {
      created,
      skipped,
      summary: {
        requested: dto.units.length,
        created: created.length,
        skipped: skipped.length,
      },
    };
  }

  async findAll(
    organizationId: string,
    query: PaginationDto & { buildingId?: string; status?: string },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.buildingId) {
      filter.buildingId = new Types.ObjectId(query.buildingId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.unitModel
        .find(filter)
        .populate({
          path: 'buildingId',
          select: 'name details.totalFloors details.totalUnits code',
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.unitModel.countDocuments(filter),
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

  async findOne(organizationId: string, id: string): Promise<UnitDocument> {
    const unit = await this.unitModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!unit) {
      throw new NotFoundException('Unit not found.');
    }

    return unit;
  }

  async update(organizationId: string, id: string, dto: UpdateUnitDto): Promise<UnitDocument> {
    const updatePayload: Record<string, unknown> = { ...dto };
    if (dto.buildingId) {
      updatePayload.buildingId = new Types.ObjectId(dto.buildingId);
    }

    const unit = await this.unitModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      updatePayload,
      { new: true },
    );

    if (!unit) {
      throw new NotFoundException('Unit not found.');
    }

    return unit;
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: Unit['status'],
  ): Promise<UnitDocument> {
    const unit = await this.unitModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      { status },
      { new: true },
    );

    if (!unit) {
      throw new NotFoundException('Unit not found.');
    }

    return unit;
  }

  async remove(organizationId: string, id: string): Promise<UnitDocument> {
    const unit = await this.unitModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      { deletedAt: new Date(), isActive: false },
      { new: true },
    );

    if (!unit) {
      throw new NotFoundException('Unit not found.');
    }

    return unit;
  }

  async leaseHistory(organizationId: string, unitId: string) {
    return this.leaseModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        unitId: new Types.ObjectId(unitId),
        deletedAt: null,
      })
      .populate('tenantId', 'tenantCode personalInfo contact status')
      .populate('buildingId', 'name code')
      .sort({ createdAt: -1 });
  }

  private async generateNextUnitIdentifiers(
    organizationId: Types.ObjectId,
    building: BuildingDocument,
  ): Promise<{ code: string; unitNumber: string }> {
    const units = await this.unitModel
      .find({
        organizationId,
        buildingId: building._id,
      })
      .select('code unitNumber')
      .lean();

    const sequence = getNextSequentialNumber(
      units.map((unit) => unit.code),
      building.unitCodePrefix?.trim() || 'UNT',
    );

    return this.buildUnitIdentifiers(building, sequence);
  }

  private async resolveBuildingForBulkUnit(
    organizationId: Types.ObjectId,
    buildingId?: string,
    buildingCode?: string,
    cache?: Map<string, BuildingDocument>,
  ): Promise<BuildingDocument> {
    if (buildingId) {
      const cacheKey = `id:${buildingId}`;
      const cachedBuilding = cache?.get(cacheKey);
      if (cachedBuilding) {
        return cachedBuilding;
      }

      const building = await this.buildingModel.findOne({
        _id: new Types.ObjectId(buildingId),
        organizationId,
        deletedAt: null,
      });

      if (!building) {
        throw new NotFoundException('Building not found.');
      }

      cache?.set(cacheKey, building);
      cache?.set(`code:${building.code}`, building);
      return building;
    }

    if (!buildingCode?.trim()) {
      throw new BadRequestException(
        'Each bulk unit must include buildingId or buildingCode, or provide a top-level buildingCode.',
      );
    }

    const normalizedCode = buildingCode.trim();
    const cachedBuilding = cache?.get(`code:${normalizedCode}`);
    if (cachedBuilding) {
      return cachedBuilding;
    }

    const building = await this.buildingModel.findOne({
      organizationId,
      code: normalizedCode,
      deletedAt: null,
    });

    if (!building) {
      throw new NotFoundException(`Building not found for code ${normalizedCode}.`);
    }

    cache?.set(`code:${normalizedCode}`, building);
    cache?.set(`id:${building._id.toString()}`, building);
    return building;
  }

  private async assertBuildingCapacity(
    building: BuildingDocument,
    floor: number,
    organizationId: Types.ObjectId,
  ): Promise<void> {
    const constraints = this.getBuildingConstraints(building);
    if (constraints.totalFloors !== undefined && floor > constraints.totalFloors) {
      throw new BadRequestException(
        `Floor ${floor} exceeds building total floors ${constraints.totalFloors}.`,
      );
    }

    if (constraints.totalUnits === undefined) {
      return;
    }

    const currentUnits = await this.unitModel.countDocuments({
      organizationId,
      buildingId: building._id,
      deletedAt: null,
    });

    if (currentUnits >= constraints.totalUnits) {
      throw new BadRequestException(
        `Building unit limit exceeded. Capacity is ${constraints.totalUnits}.`,
      );
    }
  }

  private getBuildingConstraints(building: BuildingDocument): {
    totalFloors?: number;
    totalUnits?: number;
  } {
    const details = building.details as Record<string, unknown> | undefined;
    const totalFloors = this.toPositiveInteger(details?.totalFloors);
    const totalUnits = this.toPositiveInteger(details?.totalUnits);

    return {
      totalFloors,
      totalUnits,
    };
  }

  private toPositiveInteger(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return undefined;
    }

    return Math.trunc(numericValue);
  }

  private buildUnitIdentifiers(
    building: BuildingDocument,
    sequence: number,
  ): { code: string; unitNumber: string } {
    const prefix = building.unitCodePrefix?.trim() || 'UNT';
    const length = building.unitCodeLength ?? 4;

    return {
      code: formatSequentialCode(prefix, length, sequence),
      unitNumber: String(sequence).padStart(length, '0'),
    };
  }

  private async getBulkBuildingState(
    organizationId: Types.ObjectId,
    building: BuildingDocument,
    stateByBuilding: Map<
      string,
      { building: BuildingDocument; existingCount: number; nextSequence: number }
    >,
  ): Promise<{ building: BuildingDocument; existingCount: number; nextSequence: number }> {
    const cacheKey = building._id.toString();
    const existingState = stateByBuilding.get(cacheKey);
    if (existingState) {
      return existingState;
    }

    const units = await this.unitModel
      .find({
        organizationId,
        buildingId: building._id,
        deletedAt: null,
      })
      .select('code')
      .lean();

    const state = {
      building,
      existingCount: units.length,
      nextSequence: getNextSequentialNumber(
        units.map((unit) => unit.code),
        building.unitCodePrefix?.trim() || 'UNT',
      ),
    };

    stateByBuilding.set(cacheKey, state);
    return state;
  }
}
