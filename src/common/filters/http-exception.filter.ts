import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { MongoServerError } from 'mongodb';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: Record<string, unknown> = {
      message: 'Internal server error',
    };

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const result = exception.getResponse();
      payload = typeof result === 'string' ? { message: result } : (result as Record<string, unknown>);
    }

    if (exception instanceof MongoServerError) {
      statusCode = HttpStatus.BAD_REQUEST;
      payload = this.mapMongoError(exception);
    }

    this.logger.error(
      `${request.method} ${request.url} -> ${statusCode}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(statusCode).json({
      success: false,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...payload,
    });
  }

  private mapMongoError(error: MongoServerError): Record<string, unknown> {
    if (error.code === 11000) {
      return {
        message: 'Duplicate key error',
        details: error.keyValue,
      };
    }

    return {
      message: 'Database error',
      details: error.message,
    };
  }
}
