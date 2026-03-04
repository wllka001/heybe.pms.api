import { IsIn, IsString } from 'class-validator';

export class ProcessPayrollDto {
  @IsIn(['bank_transfer', 'cash', 'cheque'])
  method: 'bank_transfer' | 'cash' | 'cheque';

  @IsString()
  transactionIdPrefix: string;
}
