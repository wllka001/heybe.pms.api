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
import {
  formatSequentialCode,
  generateYearMonthPrefix,
  getNextSequentialNumber,
} from '@/common/utils/generate-code.utils';
import { Employee, EmployeeDocument } from './schemas/employee.schema';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  async create(organizationId: string, dto: CreateEmployeeDto): Promise<EmployeeDocument> {
    const orgObjectId = new Types.ObjectId(organizationId);
    let employeeCode = dto.employeeCode;

    if (!employeeCode) {
      employeeCode = await this.generateNextEmployeeCode(organizationId);
    } else {
      const exists = await this.employeeModel.findOne({
        organizationId: orgObjectId,
        employeeCode,
        deletedAt: null,
      });

      if (exists) {
        throw new ConflictException('Employee code already exists.');
      }
    }

    const idExists = await this.employeeModel.findOne({
      organizationId: orgObjectId,
      'personalInfo.idNumber': dto.personalInfo.idNumber,
      deletedAt: null,
    });

    if (idExists) {
      throw new ConflictException('Employee already exists by ID number.');
    }

    return this.employeeModel.create({
      ...dto,
      employeeCode,
      organizationId: orgObjectId,
      primaryBuildingId: dto.primaryBuildingId
        ? new Types.ObjectId(dto.primaryBuildingId)
        : undefined,
      status: 'active',
    });
  }

  private async generateNextEmployeeCode(organizationId: string): Promise<string> {
    const yearMonth = generateYearMonthPrefix();
    const prefix = `EMP-${yearMonth}-`;

    const items = await this.employeeModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        employeeCode: new RegExp(`^${prefix}`),
        deletedAt: null,
      })
      .select('employeeCode')
      .lean();

    const sequence = getNextSequentialNumber(
      items.map((i: any) => i.employeeCode),
      prefix,
    );

    return formatSequentialCode(prefix, 4, sequence);
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
