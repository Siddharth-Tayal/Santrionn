'use strict';

const path = require('path');
const { z } = require('zod');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const DEV_JWT_SECRET = 'dev-only-insecure-secret-must-be-replaced-000000';

const csv = z
  .string()
  .transform((value) => value.split(',').map((v) => v.trim()).filter(Boolean));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('1h'),
    AUTH_COOKIE_NAME: z.string().default('dr_access'),
    CSRF_COOKIE_NAME: z.string().default('dr_csrf'),
    CSRF_HEADER_NAME: z.string().default('x-csrf-token'),

    CORS_ORIGINS: csv.default('http://localhost:3000'),

    GEOCODER_PROVIDER: z.enum(['mock', 'nominatim']).default('mock'),
    GEOCODER_BASE_URL: z.string().default('https://nominatim.openstreetmap.org'),
    GEOCODER_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
    GEOCODER_USER_AGENT: z.string().default('disaster-response/1.0'),

    CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    REPORTS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),

    SOCIAL_API_BASE_URL: z.string().default('mock://social'),
    SOCIAL_API_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
    SOCIAL_API_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0),

    SSE_HEARTBEAT_MS: z.coerce.number().int().positive().default(25000),
    SSE_MAX_CLIENTS: z.coerce.number().int().positive().default(200),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    WRITE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV === 'production') {
      if (values.JWT_SECRET === DEV_JWT_SECRET) {
        ctx.addIssue({ path: ['JWT_SECRET'], code: 'custom',
          message: 'The development JWT_SECRET cannot be used in production' });
      }
      if (values.CORS_ORIGINS.some((o) => o === '*')) {
        ctx.addIssue({ path: ['CORS_ORIGINS'], code: 'custom',
          message: 'Wildcard CORS_ORIGINS is not allowed in production' });
      }
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  ${i.path.join('.') || '(env)'}: ${i.message}`)
    .join('\n');
  console.error('Invalid environment configuration:\n' + details);
  throw new Error('Invalid environment configuration');
}

const config = Object.freeze({ ...parsed.data, DEV_JWT_SECRET });
module.exports = config;
