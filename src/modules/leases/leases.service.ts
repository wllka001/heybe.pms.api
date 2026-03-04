import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Invoice, InvoiceDocument } from '@/modules/finance/schemas/invoice.schema';
import { Tenant, TenantDocument } from '@/modules/tenants/schemas/tenant.schema';
import { Unit, UnitDocument } from '@/modules/units/schemas/unit.schema';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { TerminateLeaseDto } from './dto/terminate-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { Lease, LeaseDocument } from './schemas/lease.schema';

@Injectable()
export class LeasesService {
  constructor(
    @InjectModel(Lease.name) private readonly leaseModel: Model<LeaseDocument>,
    @InjectModel(Unit.name) private readonly unitModel: Model<UnitDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(organizationId: string, dto: CreateLeaseDto): Promise<LeaseDocument> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const orgObjectId = new Types.ObjectId(organizationId);

      const existing = await this.leaseModel.findOne({
        organizationId: orgObjectId,
        leaseNumber: dto.leaseNumber,
        deletedAt: null,
      });

      if (existing) {
        throw new ConflictException('Lease number already exists.');
      }

      const unit = await this.unitModel.findOne({
        _id: new Types.ObjectId(dto.unitId),
        organizationId: orgObjectId,
        deletedAt: null,
      }).session(session);

      if (!unit) {
        throw new NotFoundException('Unit not found.');
      }

      if (unit.buildingId.toString() !== dto.buildingId) {
        throw new BadRequestException('Selected unit does not belong to the selected building.');
      }

      if (unit.status === 'occupied' && dto.status !== 'draft') {
        throw new BadRequestException('Unit is already occupied.');
      }

      const tenant = await this.tenantModel.findOne({
        _id: new Types.ObjectId(dto.tenantId),
        organizationId: orgObjectId,
        deletedAt: null,
      }).session(session);

      if (!tenant) {
        throw new NotFoundException('Tenant not found.');
      }

      if ((dto.status ?? 'active') === 'active') {
        this.assertTenantVerified(tenant);
        this.assertUnitVacant(unit);
        await this.assertNoOtherActiveTenantLease(orgObjectId, tenant._id, session);
      }

      const lease = await this.leaseModel.create(
        [
          {
            ...dto,
            organizationId: orgObjectId,
            tenantId: new Types.ObjectId(dto.tenantId),
            buildingId: new Types.ObjectId(dto.buildingId),
            unitId: new Types.ObjectId(dto.unitId),
            status: dto.status ?? 'active',
          },
        ],
        { session },
      );

      const leaseDoc = lease[0];

      if (leaseDoc.status === 'active') {
        await this.unitModel.updateOne(
          { _id: unit._id },
          {
            status: 'occupied',
            currentLeaseId: leaseDoc._id,
            currentTenantId: tenant._id,
          },
          { session },
        );

        await this.tenantModel.updateOne(
          { _id: tenant._id },
          {
            status: 'active',
            currentLeaseId: leaseDoc._id,
            currentUnitId: unit._id,
          },
          { session },
        );
      }

      await session.commitTransaction();
      return this.hydrateLease(leaseDoc._id.toString());
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async findAll(
    organizationId: string,
    query: PaginationDto & { status?: string },
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

    const [data, total] = await Promise.all([
      this.leaseModel
        .find(filter)
        .populate('tenantId', 'tenantCode personalInfo contact status')
        .populate('unitId', 'unitNumber floor type status marketRent buildingId')
        .populate('buildingId', 'name code')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.leaseModel.countDocuments(filter),
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

  async findOne(organizationId: string, id: string): Promise<LeaseDocument> {
    const lease = await this.leaseModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    })
      .populate('tenantId', 'tenantCode personalInfo contact status')
      .populate('unitId', 'unitNumber floor type status marketRent buildingId')
      .populate('buildingId', 'name code');

    if (!lease) {
      throw new NotFoundException('Lease not found.');
    }

    return lease;
  }

  async update(organizationId: string, id: string, dto: UpdateLeaseDto): Promise<LeaseDocument> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const orgObjectId = new Types.ObjectId(organizationId);
      const lease = await this.leaseModel.findOne({
        _id: new Types.ObjectId(id),
        organizationId: orgObjectId,
        deletedAt: null,
      });

      if (!lease) {
        throw new NotFoundException('Lease not found.');
      }

      const previousStatus = lease.status;
      const previousUnitId = lease.unitId.toString();
      const previousTenantId = lease.tenantId.toString();

      const nextStatus = dto.status ?? lease.status;
      const nextUnitId = dto.unitId ?? lease.unitId.toString();
      const nextTenantId = dto.tenantId ?? lease.tenantId.toString();
      const nextBuildingId = dto.buildingId ?? lease.buildingId.toString();

      const unit = await this.unitModel.findOne({
        _id: new Types.ObjectId(nextUnitId),
        organizationId: orgObjectId,
        deletedAt: null,
      }).session(session);

      if (!unit) {
        throw new NotFoundException('Unit not found.');
      }

      if (unit.buildingId.toString() !== nextBuildingId) {
        throw new BadRequestException('Selected unit does not belong to the selected building.');
      }

      const tenant = await this.tenantModel.findOne({
        _id: new Types.ObjectId(nextTenantId),
        organizationId: orgObjectId,
        deletedAt: null,
      }).session(session);

      if (!tenant) {
        throw new NotFoundException('Tenant not found.');
      }

      if (
        nextStatus === 'active' &&
        unit.status === 'occupied' &&
        unit.currentLeaseId?.toString() !== lease._id.toString()
      ) {
        throw new BadRequestException('Unit is already occupied by another lease.');
      }

      if (nextStatus === 'active') {
        this.assertTenantVerified(tenant);
        this.assertUnitVacant(unit, lease._id);
        await this.assertNoOtherActiveTenantLease(orgObjectId, tenant._id, session, lease._id);
      }

      const updatePayload: Record<string, unknown> = { ...dto };
      if (dto.tenantId) {
        updatePayload.tenantId = new Types.ObjectId(dto.tenantId);
      }
      if (dto.buildingId) {
        updatePayload.buildingId = new Types.ObjectId(dto.buildingId);
      }
      if (dto.unitId) {
        updatePayload.unitId = new Types.ObjectId(dto.unitId);
      }

      const updatedLease = await this.leaseModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          organizationId: orgObjectId,
          deletedAt: null,
        },
        updatePayload,
        { new: true, session },
      );

      if (!updatedLease) {
        throw new NotFoundException('Lease not found.');
      }

      const movedReference =
        previousUnitId !== nextUnitId || previousTenantId !== nextTenantId;
      const deactivated = previousStatus === 'active' && nextStatus !== 'active';
      const activated = nextStatus === 'active';

      if (movedReference || deactivated) {
        await this.unitModel.updateOne(
          { _id: new Types.ObjectId(previousUnitId), organizationId: orgObjectId, deletedAt: null },
          { status: 'vacant', $unset: { currentLeaseId: '', currentTenantId: '' } },
          { session },
        );
        await this.tenantModel.updateOne(
          { _id: new Types.ObjectId(previousTenantId), organizationId: orgObjectId, deletedAt: null },
          { status: 'inactive', $unset: { currentLeaseId: '', currentUnitId: '' } },
          { session },
        );
      }

      if (activated) {
        await this.unitModel.updateOne(
          { _id: new Types.ObjectId(nextUnitId), organizationId: orgObjectId, deletedAt: null },
          {
            status: 'occupied',
            currentLeaseId: updatedLease._id,
            currentTenantId: new Types.ObjectId(nextTenantId),
          },
          { session },
        );
        await this.tenantModel.updateOne(
          { _id: new Types.ObjectId(nextTenantId), organizationId: orgObjectId, deletedAt: null },
          {
            status: 'active',
            currentLeaseId: updatedLease._id,
            currentUnitId: new Types.ObjectId(nextUnitId),
          },
          { session },
        );
      }

      await session.commitTransaction();
      return this.hydrateLease(updatedLease._id.toString());
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async terminate(
    organizationId: string,
    id: string,
    dto: TerminateLeaseDto,
    userId: string,
  ): Promise<LeaseDocument> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const lease = await this.leaseModel.findOne({
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      });

      if (!lease) {
        throw new NotFoundException('Lease not found.');
      }

      lease.status = 'terminated';
      lease.termination = {
        reason: dto.reason,
        date: new Date(),
        approvedBy: new Types.ObjectId(userId),
        fees: dto.fees ?? 0,
      };

      await lease.save({ session });

      await this.unitModel.updateOne(
        {
          _id: lease.unitId,
          organizationId: new Types.ObjectId(organizationId),
          deletedAt: null,
        },
        {
          status: 'vacant',
          $unset: { currentLeaseId: '', currentTenantId: '' },
        },
        { session },
      );

      await this.tenantModel.updateOne(
        {
          _id: lease.tenantId,
          organizationId: new Types.ObjectId(organizationId),
          deletedAt: null,
        },
        {
          status: 'inactive',
          $unset: { currentLeaseId: '', currentUnitId: '' },
        },
        { session },
      );

      await session.commitTransaction();
      return lease;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async renew(organizationId: string, id: string, dto: RenewLeaseDto): Promise<LeaseDocument> {
    const lease = await this.leaseModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!lease) {
      throw new NotFoundException('Lease not found.');
    }

    lease.period.startDate = new Date(dto.startDate);
    lease.period.endDate = new Date(dto.endDate);

    if (dto.rentAmount !== undefined) {
      lease.terms.rentAmount = dto.rentAmount;
    }

    lease.status = 'active';

    await lease.save();
    return lease;
  }

  async getActiveLeases(organizationId: string): Promise<LeaseDocument[]> {
    return this.leaseModel.find({
      organizationId: new Types.ObjectId(organizationId),
      status: 'active',
      deletedAt: null,
    })
      .populate('tenantId', 'tenantCode personalInfo contact status')
      .populate('unitId', 'unitNumber floor type status marketRent buildingId')
      .populate('buildingId', 'name code');
  }

  async leaseInvoices(organizationId: string, leaseId: string) {
    return this.invoiceModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        leaseId: new Types.ObjectId(leaseId),
        deletedAt: null,
      })
      .sort({ 'period.year': -1, 'period.month': -1 });
  }

  private hydrateLease(id: string): Promise<LeaseDocument> {
    return this.leaseModel
      .findById(new Types.ObjectId(id))
      .populate('tenantId', 'tenantCode personalInfo contact status')
      .populate('unitId', 'unitNumber floor type status marketRent buildingId')
      .populate('buildingId', 'name code') as Promise<LeaseDocument>;
  }

  private assertTenantVerified(tenant: TenantDocument): void {
    if (!tenant.isVerified) {
      throw new BadRequestException('Tenant must be verified before activating lease.');
    }
  }

  private assertUnitVacant(unit: UnitDocument, currentLeaseId?: Types.ObjectId): void {
    const isCurrentLease = currentLeaseId && unit.currentLeaseId?.toString() === currentLeaseId.toString();
    if (unit.status !== 'vacant' && !isCurrentLease) {
      throw new BadRequestException('Unit must be VACANT before activating lease.');
    }
  }

  private async assertNoOtherActiveTenantLease(
    organizationId: Types.ObjectId,
    tenantId: Types.ObjectId,
    session: ClientSession,
    currentLeaseId?: Types.ObjectId,
  ): Promise<void> {
    const filter: Record<string, unknown> = {
      organizationId,
      tenantId,
      status: 'active',
      deletedAt: null,
    };

    if (currentLeaseId) {
      filter._id = { $ne: currentLeaseId };
    }

    const activeLease = await this.leaseModel.findOne(filter).session(session);
    if (activeLease) {
      throw new ConflictException('Tenant already has an active lease.');
    }
  }
}
