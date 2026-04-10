import { IsMongoId, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsMongoId()
  primaryBuildingId?: string;

  @IsObject()
  personalInfo: {
    firstName: string;
    lastName: string;
    idNumber: string;
    gender?: 'male' | 'female' | 'other';
    dateOfBirth?: Date;
  };

  @IsObject()
  contact: {
    primaryPhone: string;
    secondaryPhone?: string;
    email: string;
  };

  @IsObject()
  employment: {
    position: string;
    department?: string;
    startDate: Date;
    employmentType?: string;
    role: string;
  };

  @IsObject()
  salary: {
    amount: number;
    frequency?: 'monthly' | 'biweekly' | 'weekly';
    bankAccount?: {
      bankName?: string;
      accountNumber?: string;
      branch?: string;
    };
  };
}
