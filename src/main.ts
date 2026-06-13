import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression = require('compression');
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const appName = configService.get<string>('app.name', 'Degaanly API');
  const appVersion = configService.get<string>('app.version', '1.0.0');
  const port = configService.get<number>('app.port', 3000);
  const corsOrigin = configService.get<string>('app.corsOrigin', '*');

  app.setGlobalPrefix(apiPrefix);
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({ origin: corsOrigin, credentials: true });

  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle(appName)
    .setDescription('Degaanly System API')
    .setVersion(appVersion)
    .addBearerAuth()
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDoc);

  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/${apiPrefix}`, 'Bootstrap');
}

void bootstrap();
