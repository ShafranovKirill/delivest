import { resolve } from 'path';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: (process.env.DATABASE_URL as string) || env('DATABASE_URL'),
  },
});
