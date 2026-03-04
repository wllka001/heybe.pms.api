import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FileUploadService } from '@/shared/file-upload/file-upload.service';
import { AssignWorkOrderDto } from './dto/assign-work-order.dto';
import { AddAttachmentDto } from './dto/add-attachment.dto';
import { CompleteRequestDto } from './dto/complete-request.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from './schemas/maintenance-request.schema';
import { Vendor, VendorDocument } from './schemas/vendor.schema';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private readonly requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async createRequest(
    organizationId: string,
    dto: CreateRequestDto,
    userId?: string,
  ): Promise<MaintenanceRequestDocument> {
    const exists = await this.requestModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      requestNumber: dto.requestNumber,
      deletedAt: null,
    });

    if (exists) {
      throw new ConflictException('Maintenance request number already exists.');
    }

    const request = await this.requestModel.create({
      ...dto,
      organizationId: new Types.ObjectId(organizationId),
      buildingId: new Types.ObjectId(dto.buildingId),
      unitId: new Types.ObjectId(dto.unitId),
      tenantId: dto.tenantId ? new Types.ObjectId(dto.tenantId) : undefined,
      assignedToId: dto.assignedToId ? new Types.ObjectId(dto.assignedToId) : undefined,
      vendorId: dto.vendorId ? new Types.ObjectId(dto.vendorId) : undefined,
      status: dto.status ?? 'pending',
      billing: dto.billing
        ? {
            ...dto.billing,
            invoiceId: dto.billing.invoiceId
              ? new Types.ObjectId(dto.billing.invoiceId)
              : undefined,
          }
        : undefined,
      completion: dto.completion,
      cost: dto.cost,
      statusHistory: [
        {
          status: dto.status ?? 'pending',
          changedAt: new Date(),
          changedBy: userId ? new Types.ObjectId(userId) : undefined,
          notes: 'Request created',
        },
      ],
    });

    return request;
  }

  async listRequests(
    organizationId: string,
    query: PaginationDto & { status?: string; priority?: string },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.priority) {
      filter['issue.priority'] = query.priority;
    }

    const [data, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .populate('buildingId', 'name code')
        .populate('unitId', 'unitNumber floor type status')
        .populate('tenantId', 'tenantCode personalInfo contact status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.requestModel.countDocuments(filter),
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

  async getRequest(
    organizationId: string,
    id: string,
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    })
      .populate('buildingId', 'name code')
      .populate('unitId', 'unitNumber floor type status')
      .populate('tenantId', 'tenantCode personalInfo contact status');

    if (!request) {
      throw new NotFoundException('Maintenance request not found.');
    }

    return request;
  }

  async updateRequest(
    organizationId: string,
    id: string,
    dto: UpdateRequestDto,
  ): Promise<MaintenanceRequestDocument> {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.buildingId) payload.buildingId = new Types.ObjectId(dto.buildingId);
    if (dto.unitId) payload.unitId = new Types.ObjectId(dto.unitId);
    if (dto.tenantId) payload.tenantId = new Types.ObjectId(dto.tenantId);
    if (dto.assignedToId) payload.assignedToId = new Types.ObjectId(dto.assignedToId);
    if (dto.vendorId) payload.vendorId = new Types.ObjectId(dto.vendorId);
    if (dto.billing?.invoiceId) {
      payload.billing = {
        ...dto.billing,
        invoiceId: new Types.ObjectId(dto.billing.invoiceId),
      };
    }

    const request = await this.requestModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      payload,
      { new: true },
    );

    if (!request) {
      throw new NotFoundException('Maintenance request not found.');
    }

    return request;
  }

  async assignRequest(
    organizationId: string,
    id: string,
    dto: AssignWorkOrderDto,
    userId: string,
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.getRequest(organizationId, id);

    request.assignedToId = dto.assignedToId
      ? new Types.ObjectId(dto.assignedToId)
      : undefined;
    request.vendorId = dto.vendorId ? new Types.ObjectId(dto.vendorId) : undefined;
    request.status = dto.status;
    request.statusHistory.push({
      status: dto.status,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(userId),
      notes: 'Assigned',
    });

    await request.save();
    return request;
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: MaintenanceRequest['status'],
    userId: string,
    notes?: string,
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.getRequest(organizationId, id);
    request.status = status;
    request.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(userId),
      notes: notes || 'Status updated',
    });
    await request.save();
    return request;
  }

  async addCost(
    organizationId: string,
    id: string,
    cost: { labor?: number; parts?: number; estimated?: number; actual?: number },
    userId: string,
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.getRequest(organizationId, id);
    const labor = cost.labor ?? 0;
    const parts = cost.parts ?? 0;
    const total = labor + parts;

    request.cost = {
      ...request.cost,
      ...cost,
      total,
      approvedBy: new Types.ObjectId(userId),
      approvedAt: new Date(),
    };

    await request.save();
    return request;
  }

  async completeRequest(
    organizationId: string,
    id: string,
    dto: CompleteRequestDto,
    userId: string,
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.getRequest(organizationId, id);

    request.status = 'completed';
    request.completion = {
      completedAt: new Date(),
      completedBy: new Types.ObjectId(userId),
      notes: dto.notes,
      tenantFeedback: dto.tenantFeedback,
    };

    request.statusHistory.push({
      status: 'completed',
      changedAt: new Date(),
      changedBy: new Types.ObjectId(userId),
      notes: 'Request completed',
    });

    if (dto.totalCost !== undefined) {
      request.cost = {
        ...request.cost,
        actual: dto.totalCost,
      };
    }

    await request.save();
    return request;
  }

  async addAttachment(
    organizationId: string,
    id: string,
    dto: AddAttachmentDto,
    userId: string,
    file?: any,
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.getRequest(organizationId, id);
    if (!file) {
      throw new ConflictException('Attachment file is required.');
    }

    const uploaded = await this.fileUploadService.uploadFile(
      file,
      `maintenance/${request._id.toString()}/attachments`,
    );

    request.attachments.push({
      url: uploaded.url,
      note: dto.note,
      type: dto.type,
      uploadedAt: new Date(),
      uploadedBy: new Types.ObjectId(userId),
    });
    await request.save();
    return request;
  }

  async createVendor(organizationId: string, dto: CreateVendorDto): Promise<VendorDocument> {
    const exists = await this.vendorModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      vendorCode: dto.vendorCode,
      deletedAt: null,
    });

    if (exists) {
      throw new ConflictException('Vendor code already exists.');
    }

    return this.vendorModel.create({
      ...dto,
      organizationId: new Types.ObjectId(organizationId),
      status: 'active',
    });
  }

  async listVendors(organizationId: string) {
    return this.vendorModel
      .find({ organizationId: new Types.ObjectId(organizationId), deletedAt: null })
      .sort({ createdAt: -1 });
  }

  async getVendor(organizationId: string, id: string): Promise<VendorDocument> {
    const vendor = await this.vendorModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }

    return vendor;
  }

  async updateVendor(
    organizationId: string,
    id: string,
    dto: UpdateVendorDto,
  ): Promise<VendorDocument> {
    const vendor = await this.vendorModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      dto,
      { new: true },
    );

    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }

    return vendor;
  }
}
