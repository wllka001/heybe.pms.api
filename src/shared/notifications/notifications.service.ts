import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendEmail(to: string, subject: string, template: string, data: Record<string, unknown>): Promise<void> {
    this.logger.log(`Email queued -> to:${to} subject:${subject} template:${template} data:${JSON.stringify(data)}`);
  }

  async sendSms(to: string, message: string): Promise<void> {
    this.logger.log(`SMS queued -> to:${to} message:${message}`);
  }
}
