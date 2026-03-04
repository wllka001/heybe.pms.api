import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee, EmployeeDocument } from './schemas/employee.schema';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  async create(organizationId: string, dto: CreateEmployeeDto): Promise<EmployeeDocument> {
    const exists = await this.employeeModel.findOne({
      organizationId: new Types.ObjectId(organizationId),
      $or: [
        { employeeCode: dto.employeeCode },
        { 'personalInfo.idNumber': dto.personalInfo.idNumber },
      ],
      deletedAt: null,
    });

    if (exists) {
      throw new ConflictException('Employee already exists by code or ID number.');
    }

    return this.employeeModel.create({
      ...dto,
      organizationId: new Types.ObjectId(organizationId),
      primaryBuildingId: dto.primaryBuildingId
        ? new Types.ObjectId(dto.primaryBuildingId)
        : undefined,
      status: 'active',
    });
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
      this.employeeModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.employeeModel.countDocuments(filter),
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

  async findOne(organizationId: string, id: string): Promise<EmployeeDocument> {
    const employee = await this.employeeModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateEmployeeDto,
  ): Promise<EmployeeDocument> {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.primaryBuildingId) {
      payload.primaryBuildingId = new Types.ObjectId(dto.primaryBuildingId);
    }

    const employee = await this.employeeModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      payload,
      { new: true },
    );

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }

  async remove(organizationId: string, id: string): Promise<EmployeeDocument> {
    const employee = await this.employeeModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      { deletedAt: new Date(), status: 'inactive' },
      { new: true },
    );

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }
}
