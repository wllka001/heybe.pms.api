import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Organization,
  OrganizationDocument,
} from './schemas/organization.schema';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { FileUploadService } from '@/shared/file-upload/file-upload.service';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    private readonly fileUploadService: FileUploadService,
  ) { }

  async create(
    dto: CreateOrganizationDto | Record<string, unknown>,
    logoFile?: any,
  ): Promise<OrganizationDocument> {
    const payload = this.normalizePayload(dto);

    const existing = await this.organizationModel.findOne({
      $or: [
        { name: payload.name },
        { registrationNumber: payload.registrationNumber },
        { taxNumber: payload.taxNumber },
      ],
      deletedAt: null,
    });

    if (existing) {
      throw new ConflictException('Organization already exists.');
    }

    let logo = payload.logo;
    if (logoFile) {
      const uploaded = await this.fileUploadService.uploadFile(
        logoFile,
        'organizations/logos',
      );
      logo = uploaded.url;
    }

    return this.organizationModel.create({
      ...payload,
      logo,
      buildingCodePrefix: payload.buildingCodePrefix?.trim() || 'BLD',
      buildingCodeLength: payload.buildingCodeLength ?? 4,
      settings: {
        baseCurrency: 'USD',
        allowedCurrencies: ['USD'],
        vatRate: payload.settings?.vatRate ?? 0,
        lateFeeType: payload.settings?.lateFeeType ?? 'fixed',
        lateFeeValue: payload.settings?.lateFeeValue ?? 0,
        gracePeriodDays: payload.settings?.gracePeriodDays ?? 5,
        invoiceDueDays: payload.settings?.invoiceDueDays ?? 5,
        rentDueDay: payload.settings?.rentDueDay ?? 1,
      },
      isActive: payload.isActive ?? true,
    });
  }

  async findAll(): Promise<OrganizationDocument[]> {
    return this.organizationModel.find({ deletedAt: null }).sort({ createdAt: -1 });
  }

  async findOne(id: string): Promise<OrganizationDocument> {
    const org = await this.organizationModel.findOne({
      _id: new Types.ObjectId(id),
      deletedAt: null,
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    return org;
  }
  async update(
    id: string,
    dto: UpdateOrganizationDto | Record<string, unknown>,
    logoFile?: any,
  ): Promise<OrganizationDocument> {
    const objectId = new Types.ObjectId(id);

    // Normalize payload (parse JSON strings if needed)
    const payload = this.normalizePayload(dto);

    // Remove immutable _id
    if ('_id' in payload) delete payload._id;

    // Handle logo upload
    if (logoFile) {
      const existing = await this.organizationModel.findOne({
        _id: objectId,
        deletedAt: null,
      });
      if (!existing) throw new NotFoundException('Organization not found.');

      if (existing.logo) {
        await this.fileUploadService.remove(existing.logo);
      }
      const uploaded = await this.fileUploadService.uploadFile(
        logoFile,
        'organizations/logos',
      );
      payload.logo = uploaded.url;
    }

    // Merge settings if exists
    if (payload.settings) {
      const existing = await this.organizationModel.findOne({
        _id: objectId,
        deletedAt: null,
      });
      payload.settings = {
        ...(existing?.settings as Record<string, unknown>),
        ...payload.settings,
      };
    }

    // Update organization
    const org = await this.organizationModel.findOneAndUpdate(
      { _id: objectId, deletedAt: null },
      payload,
      { new: true },
    );

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    return org;
  }
  async remove(id: string): Promise<OrganizationDocument> {
    const org = await this.organizationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), deletedAt: null },
      { deletedAt: new Date(), isActive: false },
      { new: true },
    );

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    return org;
  }

  private normalizePayload(
    raw: CreateOrganizationDto | UpdateOrganizationDto | Record<string, unknown>,
  ): Record<string, any> {
    const payload: Record<string, any> = { ...raw };

    for (const field of ['address', 'contact', 'settings']) {
      if (typeof payload[field] === 'string') {
        try {
          payload[field] = JSON.parse(payload[field]);
        } catch {
          payload[field] = undefined;
        }
      }
    }

    if (typeof payload.isActive === 'string') {
      payload.isActive = payload.isActive.toLowerCase() === 'true';
    }

    if (payload.settings && typeof payload.settings === 'object') {
      const numericSettingKeys = [
        'vatRate',
        'lateFeeValue',
        'gracePeriodDays',
        'invoiceDueDays',
        'rentDueDay',
      ];
      for (const key of numericSettingKeys) {
        if (payload.settings[key] !== undefined) {
          const numericValue = Number(payload.settings[key]);
          if (!Number.isNaN(numericValue)) {
            payload.settings[key] = numericValue;
          }
        }
      }
    }

    if (payload.buildingCodePrefix !== undefined) {
      payload.buildingCodePrefix = String(payload.buildingCodePrefix).trim() || 'BLD';
    }

    if (payload.buildingCodeLength !== undefined) {
      const buildingCodeLength = Number(payload.buildingCodeLength);
      if (!Number.isNaN(buildingCodeLength)) {
        payload.buildingCodeLength = Math.max(1, Math.trunc(buildingCodeLength));
      }
    }

    return payload;
  }
}
