import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  INGEST_CRON_SCHEDULE: z.string().default('*/5 * * * *'),
  GEMINI_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  GROQ_API_KEY: z.string().optional().default(''),
  SAMBANOVA_API_KEY: z.string().optional().default(''),
  SAMBANOVA_BASE_URL: z.string().default('https://api.sambanova.ai/v1'),
  MISTRAL_API_KEY: z.string().optional().default(''),
  MISTRAL_BASE_URL: z.string().default('https://api.mistral.ai/v1'),
  CLOUDFLARE_API_TOKEN: z.string().optional().default(''),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional().default(''),
  CLOUDFLARE_BASE_URL: z.string().default('https://api.cloudflare.com/client/v4/accounts'),
  JWT_SECRET: z.string().default('newsflow_super_secret_jwt_key_2026'),
  GOOGLE_WEB_CLIENT_ID: z.string().optional().default(''),
});

export const env = envSchema.parse(process.env);
