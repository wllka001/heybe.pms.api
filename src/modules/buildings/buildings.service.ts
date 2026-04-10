import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  formatSequentialCode,
  getNextSequentialNumber,
} from '@/common/utils/generate-code.utils';
import {
  Organization,
  OrganizationDocument,
} from '@/modules/organizations/schemas/organization.schema';
import { Unit, UnitDocument } from '@/modules/units/schemas/unit.schema';
import { Building, BuildingDocument } from './schemas/building.schema';
import { CreateBuildingDto } from './dto/create-building.dto';
import { ListBuildingsDto } from './dto/list-buildings.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingsService {
  constructor(
    @InjectModel(Building.name)
    private readonly buildingModel: Model<BuildingDocument>,
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    @InjectModel(Unit.name)
    private readonly unitModel: Model<UnitDocument>,
  ) { }

  async create(organizationId: string, dto: CreateBuildingDto): Promise<BuildingDocument> {
    const organization = await this.organizationModel.findOne({
      // _id: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    const code = await this.generateNextBuildingCode(organization);

    return this.buildingModel.create({
      ...dto,
      code,
      organizationId: new Types.ObjectId(organizationId),
      unitCodePrefix: dto.unitCodePrefix?.trim() || 'UNT',
      unitCodeLength: dto.unitCodeLength ?? 4,
      tenantCodePrefix: dto.tenantCodePrefix?.trim() || 'TEN',
      tenantCodeLength: dto.tenantCodeLength ?? 4,
      isActive: true,
    });
  }

  async findAll(organizationId: string, query: ListBuildingsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.status) {
      filter.isActive = query.status === 'active';
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { 'address.street': searchRegex },
        { 'address.city': searchRegex },
        { 'address.district': searchRegex },
        { 'address.region': searchRegex },
      ];
    }

    const [data, total] = await Promise.all([
      this.buildingModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.buildingModel.countDocuments(filter),
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

  async findOne(organizationId: string, id: string): Promise<BuildingDocument> {
    const building = await this.buildingModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!building) {
      throw new NotFoundException('Building not found.');
    }

    return building;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateBuildingDto,
  ): Promise<BuildingDocument> {
    const building = await this.buildingModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      dto,
      { new: true, runValidators: true },
    );

    if (!building) {
      throw new NotFoundException('Building not found.');
    }

    return building;
  }

  async remove(organizationId: string, id: string): Promise<BuildingDocument> {
    const building = await this.buildingModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      { deletedAt: new Date(), isActive: false },
      { new: true },
    );

    if (!building) {
      throw new NotFoundException('Building not found.');
    }

    return building;
  }

  async getUnits(organizationId: string, buildingId: string) {
    return this.unitModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        buildingId: new Types.ObjectId(buildingId),
        deletedAt: null,
      })
      .sort({ floor: 1, unitNumber: 1 });
  }

  async getStats(organizationId: string, buildingId: string) {
    const filter = {
      organizationId: new Types.ObjectId(organizationId),
      buildingId: new Types.ObjectId(buildingId),
      deletedAt: null,
    };

    const [totalUnits, occupiedUnits, vacantUnits, reservedUnits, maintenanceUnits] =
      await Promise.all([
        this.unitModel.countDocuments(filter),
        this.unitModel.countDocuments({ ...filter, status: 'occupied' }),
        this.unitModel.countDocuments({ ...filter, status: 'vacant' }),
        this.unitModel.countDocuments({ ...filter, status: 'reserved' }),
        this.unitModel.countDocuments({ ...filter, status: 'under_maintenance' }),
      ]);

    const occupancyRate =
      totalUnits === 0 ? 0 : Number(((occupiedUnits / totalUnits) * 100).toFixed(2));

    return {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      reservedUnits,
      maintenanceUnits,
      occupancyRate,
    };
  }

  async getStructure(organizationId: string, buildingId: string) {
    const building = await this.findOne(organizationId, buildingId);
    const organizationObjectId = new Types.ObjectId(organizationId);
    const buildingObjectId = new Types.ObjectId(buildingId);

    const units = await this.unitModel
      .find({
        organizationId: organizationObjectId,
        buildingId: buildingObjectId,
        deletedAt: null,
      })
      .populate('currentTenantId', 'tenantCode status personalInfo contact')
      .populate('currentLeaseId', 'leaseNumber status period terms')
      .sort({ floor: 1, unitNumber: 1, code: 1 });

    const floorsMap = new Map<
      number,
      {
        floor: number;
        totalUnits: number;
        occupiedUnits: number;
        vacantUnits: number;
        reservedUnits: number;
        maintenanceUnits: number;
        units: Array<Record<string, unknown>>;
      }
    >();

    for (const unit of units) {
      const floorKey = Number(unit.floor ?? 0);
      const floorGroup = floorsMap.get(floorKey) ?? {
        floor: floorKey,
        totalUnits: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        reservedUnits: 0,
        maintenanceUnits: 0,
        units: [],
      };

      floorGroup.totalUnits += 1;
      if (unit.status === 'occupied') {
        floorGroup.occupiedUnits += 1;
      } else if (unit.status === 'vacant') {
        floorGroup.vacantUnits += 1;
      } else if (unit.status === 'reserved') {
        floorGroup.reservedUnits += 1;
      } else if (unit.status === 'under_maintenance') {
        floorGroup.maintenanceUnits += 1;
      }

      const lease = unit.currentLeaseId as unknown as Record<string, unknown> | null;
      const tenant = unit.currentTenantId as unknown as Record<string, unknown> | null;
      const hasActiveLease = lease?.status === 'active';

      floorGroup.units.push({
        id: unit._id.toString(),
        code: unit.code,
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        type: unit.type,
        status: unit.status,
        marketRent: unit.marketRent,
        specifications: unit.specifications,
        features: unit.features,
        lease: hasActiveLease
          ? {
              id: String(lease?._id ?? ''),
              leaseNumber: lease?.leaseNumber,
              status: lease?.status,
              period: lease?.period,
              terms: lease?.terms,
            }
          : null,
        tenant: hasActiveLease && tenant
          ? {
              id: String(tenant._id ?? ''),
              tenantCode: tenant.tenantCode,
              status: tenant.status,
              personalInfo: tenant.personalInfo,
              contact: tenant.contact,
            }
          : null,
      });

      floorsMap.set(floorKey, floorGroup);
    }

    const floors = Array.from(floorsMap.values()).sort((a, b) => a.floor - b.floor);

    return {
      building,
      summary: {
        totalFloors: floors.length,
        totalUnits: units.length,
        occupiedUnits: floors.reduce((sum, floor) => sum + floor.occupiedUnits, 0),
        vacantUnits: floors.reduce((sum, floor) => sum + floor.vacantUnits, 0),
        reservedUnits: floors.reduce((sum, floor) => sum + floor.reservedUnits, 0),
        maintenanceUnits: floors.reduce((sum, floor) => sum + floor.maintenanceUnits, 0),
      },
      floors,
    };
  }

  private async generateNextBuildingCode(organization: OrganizationDocument): Promise<string> {
    const prefix = organization.buildingCodePrefix?.trim() || 'BLD';
    const length = organization.buildingCodeLength ?? 4;
    const buildingCodes = await this.buildingModel
      .find({ organizationId: organization._id })
      .select('code')
      .lean();

    const sequence = getNextSequentialNumber(
      buildingCodes.map((building) => building.code),
      prefix,
    );

    return formatSequentialCode(prefix, length, sequence);
  }
}
