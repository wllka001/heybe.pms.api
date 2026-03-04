import { BadRequestException } from '@nestjs/common';

export class ValidationException extends BadRequestException {
  constructor(errors: Array<Record<string, unknown>>) {
    super({
      message: 'Validation failed',
      errors,
    });
  }
}
