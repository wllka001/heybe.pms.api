import { IsDateString, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreatePayrollDto {
  @IsString()
  payrollNumber: string;

  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  year: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsDateString()
  paymentDate: string;
}
