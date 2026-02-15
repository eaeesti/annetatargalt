import type { Config } from 'drizzle-kit';

const sslEnabled = process.env.DATABASE_SSL === 'true';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    user: process.env.DATABASE_USERNAME || 'strapi',
    password: process.env.DATABASE_PASSWORD || 'strapi',
    database: process.env.DRIZZLE_DATABASE_NAME || 'annetatargalt_donations',
    ssl: sslEnabled ? {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    } : false,
  },
} satisfies Config;
