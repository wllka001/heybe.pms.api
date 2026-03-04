import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  name: process.env.APP_NAME ?? 'Apartment Management API',
  version: process.env.APP_VERSION ?? '1.0.0',
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'USD',
}));
