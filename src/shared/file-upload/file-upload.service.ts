import { randomUUID } from 'crypto';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly region: string;
  private readonly bucket?: string;
  private readonly baseUrl?: string;
  private readonly client?: any;
  private readonly PutObjectCommand?: any;
  private readonly DeleteObjectCommand?: any;

  constructor(private readonly configService: ConfigService) {
    this.region = this.getConfigValue('AWS_REGION') ?? 'us-east-1';
    this.bucket = this.getConfigValue('AWS_S3_BUCKET');
    this.baseUrl = this.getConfigValue('AWS_S3_BASE_URL');

    const accessKeyId = this.getConfigValue('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.getConfigValue('AWS_SECRET_ACCESS_KEY');

    if (this.bucket && accessKeyId && secretAccessKey) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const awsS3 = require('@aws-sdk/client-s3');
        this.PutObjectCommand = awsS3.PutObjectCommand;
        this.DeleteObjectCommand = awsS3.DeleteObjectCommand;
        this.client = new awsS3.S3Client({
          region: this.region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to initialize S3 client; uploads will fail. ${(error as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        'S3 credentials/bucket not configured; uploads will fail until AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET are set.',
      );
    }
  }

  async upload(
    buffer: Buffer,
    filename: string,
    contentType = 'application/octet-stream',
  ): Promise<{ url: string; key: string }> {
    const sanitized = filename.replace(/\s+/g, '-');
    const key = `uploads/${Date.now()}-${sanitized}`;
    return this.uploadByKey(buffer, key, contentType);
  }

  async uploadFile(
    file: any,
    folder = 'uploads',
  ): Promise<{ url: string; key: string }> {
    const extension =
      file.originalname && file.originalname.includes('.')
        ? `.${file.originalname.split('.').pop()}`
        : '';
    const key = `${folder}/${Date.now()}-${randomUUID()}${extension}`;
    return this.uploadByKey(file.buffer, key, file.mimetype);
  }

  async remove(urlOrKey: string): Promise<void> {
    if (!urlOrKey || !this.bucket || !this.client) {
      return;
    }

    const key = this.extractKey(urlOrKey);
    if (!key) {
      return;
    }

    try {
      await this.client.send(
        new this.DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to delete file from S3 key "${key}": ${(error as Error).message}`,
      );
    }
  }

  private async uploadByKey(
    buffer: Buffer,
    key: string,
    contentType = 'application/octet-stream',
  ): Promise<{ url: string; key: string }> {
    if (!this.bucket || !this.client || !this.PutObjectCommand) {
      throw new ServiceUnavailableException(
        'S3 upload is not configured correctly on the server.',
      );
    }

    try {
      await this.client.send(
        new this.PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      this.logger.log(`Uploaded file to S3 bucket "${this.bucket}" with key "${key}".`);
    } catch (error) {
      this.logger.error(
        `Failed to upload file to S3 bucket "${this.bucket}" with key "${key}".`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to upload file to S3.');
    }

    return {
      key,
      url: this.buildUrl(key),
    };
  }

  private buildUrl(key: string): string {
    if (this.baseUrl) {
      return `${this.baseUrl.replace(/\/$/, '')}/${key}`;
    }

    if (this.bucket) {
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }

    return `https://files.example.com/${key}`;
  }

  private extractKey(urlOrKey: string): string {
    if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
      return urlOrKey;
    }

    try {
      const parsed = new URL(urlOrKey);
      return parsed.pathname.replace(/^\/+/, '');
    } catch {
      return '';
    }
  }

  private getConfigValue(key: string): string | undefined {
    const value = this.configService.get<string>(key);
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }
}
