import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  APP_NAME: Joi.string().default('Apartment Management API'),
  APP_VERSION: Joi.string().default('1.0.0'),
  MONGODB_URI: Joi.string().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  REGISTRATION_TOKEN: Joi.string().optional(),
  BCRYPT_ROUNDS: Joi.number().min(8).max(15).default(12),
  CORS_ORIGIN: Joi.string().allow('*').default('*'),
  DEFAULT_CURRENCY: Joi.string().valid('USD').default('USD'),
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  AWS_S3_BUCKET: Joi.string().allow('').optional(),
  AWS_S3_BASE_URL: Joi.string().allow('').optional(),
});
