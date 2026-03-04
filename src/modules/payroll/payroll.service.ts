import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { Employee, EmployeeDocument } from '@/modules/employees/schemas/employee.schema';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { ProcessPayrollDto } from './dto/process-payroll.dto';
import { Payroll, PayrollDocument } from './schemas/payroll.schema';

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(Payroll.name)
    private readonly payrollModel: Model<PayrollDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  async generate(organizationId: string, dto: CreatePayrollDto): Promise<PayrollDocument> {
    const orgObjectId = new Types.ObjectId(organizationId);

    const exists = await this.payrollModel.findOne({
      organizationId: orgObjectId,
      payrollNumber: dto.payrollNumber,
      deletedAt: null,
    });

    if (exists) {
      throw new ConflictException('Payroll number already exists.');
    }

    const employees = await this.employeeModel.find({
      organizationId: orgObjectId,
      status: 'active',
      deletedAt: null,
    });

    const payrollEmployees = employees.map((employee) => {
      const basicSalary = Number(employee.salary?.amount ?? 0);
      const allowances = 0;
      const overtime = 0;
      const bonus = 0;
      const totalEarnings = basicSalary + allowances + overtime + bonus;
      const tax = 0;
      const loans = 0;
      const other = 0;
      const totalDeductions = tax + loans + other;
      const netPay = totalEarnings - totalDeductions;

      return {
        employeeId: employee._id,
        earnings: {
          basicSalary,
          allowances,
          overtime,
          bonus,
          totalEarnings,
        },
        deductions: {
          tax,
          loans,
          other,
          totalDeductions,
        },
        netPay,
        payment: {
          status: 'pending',
          method: 'bank_transfer',
        },
      };
    });

    const totalGrossPay = payrollEmployees.reduce(
      (sum, row) => sum + Number((row.earnings as any).totalEarnings),
      0,
    );
    const totalDeductions = payrollEmployees.reduce(
      (sum, row) => sum + Number((row.deductions as any).totalDeductions),
      0,
    );
    const totalNetPay = payrollEmployees.reduce((sum, row) => sum + row.netPay, 0);

    return this.payrollModel.create({
      organizationId: orgObjectId,
      payrollNumber: dto.payrollNumber,
      period: {
        month: dto.month,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        paymentDate: new Date(dto.paymentDate),
      },
      employees: payrollEmployees,
      summary: {
        totalGrossPay,
        totalDeductions,
        totalNetPay,
        totalEmployees: payrollEmployees.length,
      },
      status: 'draft',
    });
  }

  async findAll(
    organizationId: string,
    query: PaginationDto,
  ): Promise<{
    data: PayrollDocument[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter = {
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      this.payrollModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.payrollModel.countDocuments(filter),
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

  async findOne(organizationId: string, id: string): Promise<PayrollDocument> {
    const payroll = await this.payrollModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found.');
    }

    return payroll;
  }

  async approve(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<PayrollDocument> {
    const payroll = await this.findOne(organizationId, id);
    payroll.status = 'approved';
    payroll.approvedBy = new Types.ObjectId(userId);
    payroll.approvedAt = new Date();
    await payroll.save();
    return payroll;
  }

  async process(
    organizationId: string,
    id: string,
    dto: ProcessPayrollDto,
  ): Promise<PayrollDocument> {
    const payroll = await this.findOne(organizationId, id);

    payroll.status = 'processing';
    payroll.employees = payroll.employees.map((item, index) => ({
      ...item,
      payment: {
        ...(item.payment as Record<string, unknown>),
        status: 'paid',
        method: dto.method,
        transactionId: `${dto.transactionIdPrefix}-${index + 1}`,
        paidAt: new Date(),
      },
    }));

    payroll.status = 'completed';
    await payroll.save();
    return payroll;
  }

  async updateEmployeeItem(
    organizationId: string,
    payrollId: string,
    employeeId: string,
    body: {
      allowances?: number;
      overtime?: number;
      bonus?: number;
      tax?: number;
      loans?: number;
      other?: number;
    },
  ): Promise<PayrollDocument> {
    const payroll = await this.findOne(organizationId, payrollId);

    payroll.employees = payroll.employees.map((entry) => {
      if ((entry.employeeId as Types.ObjectId).toString() !== employeeId) {
        return entry;
      }

      const earnings = entry.earnings as Record<string, number>;
      const deductions = entry.deductions as Record<string, number>;
      const basicSalary = Number(earnings.basicSalary ?? 0);
      const allowances = Number(body.allowances ?? earnings.allowances ?? 0);
      const overtime = Number(body.overtime ?? earnings.overtime ?? 0);
      const bonus = Number(body.bonus ?? earnings.bonus ?? 0);
      const totalEarnings = basicSalary + allowances + overtime + bonus;

      const tax = Number(body.tax ?? deductions.tax ?? 0);
      const loans = Number(body.loans ?? deductions.loans ?? 0);
      const other = Number(body.other ?? deductions.other ?? 0);
      const totalDeductions = tax + loans + other;
      const netPay = totalEarnings - totalDeductions;

      return {
        ...entry,
        earnings: {
          basicSalary,
          allowances,
          overtime,
          bonus,
          totalEarnings,
        },
        deductions: {
          tax,
          loans,
          other,
          totalDeductions,
        },
        netPay,
      };
    });

    const totalGrossPay = payroll.employees.reduce(
      (sum, row) => sum + Number((row.earnings as Record<string, number>).totalEarnings ?? 0),
      0,
    );
    const totalDeductions = payroll.employees.reduce(
      (sum, row) =>
        sum + Number((row.deductions as Record<string, number>).totalDeductions ?? 0),
      0,
    );
    const totalNetPay = payroll.employees.reduce(
      (sum, row) => sum + Number(row.netPay ?? 0),
      0,
    );

    payroll.summary = {
      totalGrossPay,
      totalDeductions,
      totalNetPay,
      totalEmployees: payroll.employees.length,
    };

    await payroll.save();
    return payroll;
  }
}
