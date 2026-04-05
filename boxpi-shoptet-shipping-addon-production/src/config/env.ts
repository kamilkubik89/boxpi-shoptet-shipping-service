import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().default(''),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SHOPTET_API_BASE_URL: z.string().url().default('https://api.myshoptet.com'),
  SHOPTET_SCOPES: z.string().default(''),
  SHOPTET_INSTALL_TIMEOUT_MS: z.coerce.number().default(10000),
  SHOPTET_WEBHOOK_IP_ALLOWLIST: z.string().default('185.184.254.0/24'),
  BOXPI_BASE_URL: z.string().url(),
  BOXPI_API_KEY: z.string().min(1),
  BOXPI_DEFAULT_CARRIER: z.string().default('PACKETA-POINT-SK'),
  BOXPI_DEFAULT_COUNTRY: z.string().default('SK'),
  BOXPI_DEFAULT_COD_CURRENCY: z.string().default('EUR'),
  SHOPTET_ADDON_CODE: z.string().default(''),
  SHOPTET_SHIPPING_METHOD_CODE: z.string().default(''),
  SHOPTET_WIDGET_PUBLIC_URL: z.string().url(),
  SHOPTET_WEBHOOK_URL: z.string().url(),
  SHOPTET_INSTALL_CALLBACK_URL: z.string().url(),
  SHOPTET_SETTINGS_URL: z.string().url(),
  DEFAULT_PICKUP_CARRIER: z.string().default('PACKETA-POINT-SK'),
  PICKUP_POINTS_CACHE_TTL_SECONDS: z.coerce.number().default(900),
  SHIPPING_REQUEST_TTL_MINUTES: z.coerce.number().default(45),
  JOB_CONCURRENCY: z.coerce.number().default(5),
  HTTP_TIMEOUT_MS: z.coerce.number().default(15000)
});

export const env = EnvSchema.parse(process.env);
export const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((v) => v.trim()).filter(Boolean);
