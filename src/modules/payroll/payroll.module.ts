import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payroll, PayrollSchema } from './schemas/payroll.schema';
import { Employee, EmployeeSchema } from '@/modules/employees/schemas/employee.schema';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payroll.name, schema: PayrollSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService, MongooseModule],
})
export class PayrollModule {}
