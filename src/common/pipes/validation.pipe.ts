import {
  Injectable,
  ValidationError,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';
import { ValidationException } from '../exceptions/validation.exception';

@Injectable()
export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        const formatted = errors.map((error) => ({
          field: error.property,
          constraints: error.constraints,
        }));
        return new ValidationException(formatted);
      },
    });
  }
}
