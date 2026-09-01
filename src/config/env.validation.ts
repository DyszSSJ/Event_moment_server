import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
  FRONTEND_URL: z
    .string()
    .url('FRONTEND_URL must be a valid URL')
    .default('http://localhost:3000'),
  CLERK_SECRET_KEY: z.string().trim().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, 'CLERK_PUBLISHABLE_KEY is required'),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Environment validation failed: ${message}`);
  }

  return parsed.data;
}
