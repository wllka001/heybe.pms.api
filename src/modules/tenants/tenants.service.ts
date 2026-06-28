import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  formatSequentialCode,
  getNextSequentialNumber,
} from '@/common/utils/generate-code.utils';
import { Building, BuildingDocument } from '@/modules/buildings/schemas/building.schema';
import { Payment, PaymentDocument } from '@/modules/finance/schemas/payment.schema';
import { Lease, LeaseDocument } from '@/modules/leases/schemas/lease.schema';
import { FileUploadService } from '@/shared/file-upload/file-upload.service';
import { CreateTenantDocumentDto } from './dto/create-tenant-document.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { SearchTenantDto } from './dto/search-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantFile, TenantFileDocument } from './schemas/tenant-document.schema';
import { Tenant, TenantDocument } from './schemas/tenant.schema';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Building.name)
    private readonly buildingModel: Model<BuildingDocument>,
    @InjectModel(TenantFile.name)
    private readonly tenantFileModel: Model<TenantFileDocument>,
    @InjectModel(Lease.name)
    private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    private readonly fileUploadService: FileUploadService,
  ) { }

  async create(organizationId: string, dto: CreateTenantDto): Promise<TenantDocument> {
    const building = await this.buildingModel.findOne({
      _id: new Types.ObjectId(dto.buildingId),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!building) {
      throw new NotFoundException('Building not found.');
    }

    const tenantCode = await this.generateNextTenantCode(
      new Types.ObjectId(organizationId),
      building,
    );

    await this.ensureUniqueness(organizationId, dto);
    // this.assertVerificationConsistency(dto);

    const exists = await this.tenantModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      buildingId: new Types.ObjectId(dto.buildingId),
      $or: [
        { tenantCode },
        { 'personalInfo.idNumber': dto.personalInfo.idNumber },
        { 'contact.email': dto.contact.email },
      ],
      deletedAt: null,
    });

    if (exists) {
      throw new ConflictException('Tenant already exists by code, ID, or email.');
    }

    return this.tenantModel.create({
      ...dto,
      organizationId: new Types.ObjectId(organizationId),
      buildingId: new Types.ObjectId(dto.buildingId),
      tenantCode,
      status: dto.status ?? 'prospective',
      nationalIdNumber: dto.nationalIdNumber?.trim() || undefined,
      passportNumber: dto.passportNumber?.trim() || undefined,
      verifiedBy: dto.verifiedBy ? new Types.ObjectId(dto.verifiedBy) : undefined,
      verifiedAt: dto.isVerified ? new Date(dto.verifiedAt ?? new Date()) : undefined,
      isVerified: dto.isVerified ?? false,
      paymentSummary: {
        totalPaid: 0,
        latePayments: 0,
      },
    });
  }

  async findAll(organizationId: string, query: SearchTenantDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: FilterQuery<TenantDocument> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.buildingId) {
      filter.buildingId = new Types.ObjectId(query.buildingId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.q) {
      filter.$or = [
        { 'personalInfo.firstName': { $regex: query.q, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: query.q, $options: 'i' } },
        { 'personalInfo.idNumber': { $regex: query.q, $options: 'i' } },
        { 'contact.email': { $regex: query.q, $options: 'i' } },
        { tenantCode: { $regex: query.q, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.tenantModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.tenantModel.countDocuments(filter),
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

  async findOne(organizationId: string, id: string): Promise<TenantDocument> {
    const tenant = await this.tenantModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    return tenant;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateTenantDto,
  ): Promise<TenantDocument> {
    await this.ensureUniqueness(organizationId, dto, id);
    // this.assertVerificationConsistency(dto);

    const payload: Record<string, unknown> = { ...dto };
    if (dto.buildingId) {
      payload.buildingId = new Types.ObjectId(dto.buildingId);
    }
    if (dto.verifiedBy) {
      payload.verifiedBy = new Types.ObjectId(dto.verifiedBy);
    }
    if (dto.isVerified === true) {
      payload.verifiedAt = dto.verifiedAt ? new Date(dto.verifiedAt) : new Date();
    }
    if (dto.isVerified === false) {
      payload.$unset = { verifiedAt: '', verifiedBy: '' };
    }

    const tenant = await this.tenantModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      payload,
      { new: true },
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    return tenant;
  }

  async remove(organizationId: string, id: string): Promise<TenantDocument> {
    const tenant = await this.tenantModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      { deletedAt: new Date(), status: 'inactive' },
      { new: true },
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    return tenant;
  }

  async paymentHistory(organizationId: string, tenantId: string) {
    return this.paymentModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      })
      .sort({ paymentDate: -1, createdAt: -1 });
  }

  async leaseHistory(organizationId: string, tenantId: string) {
    return this.leaseModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      })
      .populate('unitId', 'unitNumber floor type status marketRent')
      .populate('buildingId', 'name code accountNumber')
      .sort({ createdAt: -1 });
  }

  async uploadDocument(
    organizationId: string,
    tenantId: string,
    dto: CreateTenantDocumentDto,
    file: any,
    userId?: string,
  ): Promise<TenantFileDocument> {
    if (!file) {
      throw new ConflictException('File is required.');
    }

    const tenant = await this.findOne(organizationId, tenantId);
    const uploaded = await this.fileUploadService.uploadFile(
      file,
      `tenants/${tenant._id.toString()}/documents`,
    );

    return this.tenantFileModel.create({
      organizationId: new Types.ObjectId(organizationId),
      tenantId: tenant._id,
      documentType: dto.documentType,
      documentUrl: uploaded.url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      note: dto.note?.trim() || undefined,
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
      isVerified: false,
      deletedAt: null,
    });
  }

  async listDocuments(organizationId: string, tenantId: string): Promise<TenantFileDocument[]> {
    await this.findOne(organizationId, tenantId);
    return this.tenantFileModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      })
      .sort({ createdAt: -1 });
  }

  async verifyDocument(
    organizationId: string,
    tenantId: string,
    documentId: string,
    isVerified: boolean,
    userId: string,
  ): Promise<TenantFileDocument> {
    await this.findOne(organizationId, tenantId);
    const document = await this.tenantFileModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(documentId),
        organizationId: new Types.ObjectId(organizationId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      {
        isVerified,
        verifiedAt: isVerified ? new Date() : undefined,
        verifiedBy: isVerified ? new Types.ObjectId(userId) : undefined,
      },
      { new: true },
    );

    if (!document) {
      throw new NotFoundException('Tenant document not found.');
    }

    return document;
  }

  private async ensureUniqueness(
    organizationId: string,
    dto: Partial<CreateTenantDto>,
    tenantId?: string,
  ): Promise<void> {
    const orgObjectId = new Types.ObjectId(organizationId);
    const exclusions = tenantId
      ? { _id: { $ne: new Types.ObjectId(tenantId) } }
      : {};

    if (dto.buildingId && !Types.ObjectId.isValid(dto.buildingId)) {
      throw new BadRequestException('buildingId must be a valid MongoDB ObjectId.');
    }

    if (dto.personalInfo?.idNumber) {
      const byIdNumber = await this.tenantModel.findOne({
        ...exclusions,
        organizationId: orgObjectId,
        'personalInfo.idNumber': dto.personalInfo.idNumber,
        deletedAt: null,
      });
      if (byIdNumber) {
        throw new ConflictException('Tenant personal ID already exists.');
      }
    }

    if (dto.contact?.email) {
      const byEmail = await this.tenantModel.findOne({
        ...exclusions,
        organizationId: orgObjectId,
        'contact.email': dto.contact.email,
        deletedAt: null,
      });
      if (byEmail) {
        throw new ConflictException('Tenant email already exists.');
      }
    }

    if (dto.nationalIdNumber) {
      const byNationalId = await this.tenantModel.findOne({
        ...exclusions,
        organizationId: orgObjectId,
        nationalIdNumber: dto.nationalIdNumber,
        deletedAt: null,
      });
      if (byNationalId) {
        throw new ConflictException('Tenant national ID already exists.');
      }
    }
  }

  // private assertVerificationConsistency(dto: Partial<CreateTenantDto>): void {
  //   if (dto.isVerified && !dto.verifiedBy) {
  //     throw new ConflictException('verifiedBy is required when isVerified is true.');
  //   }
  // }

  private async generateNextTenantCode(
    organizationId: Types.ObjectId,
    building: BuildingDocument,
  ): Promise<string> {
    const prefix = building.tenantCodePrefix?.trim() || 'TEN';
    const length = building.tenantCodeLength ?? 4;
    const tenantCodes = await this.tenantModel
      .find({
        organizationId,
        buildingId: building._id,
      })
      .select('tenantCode')
      .lean();

    const sequence = getNextSequentialNumber(
      tenantCodes.map((tenant) => tenant.tenantCode),
      prefix,
    );

    return formatSequentialCode(prefix, length, sequence);
  }
}
