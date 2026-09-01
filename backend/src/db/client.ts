import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, PoolConfig } from "pg";
import * as schema from "./schema";

// Database configuration from environment variables
// NOTE: Drizzle uses a SEPARATE database from Strapi for clean separation
const connectionString = process.env.DRIZZLE_DATABASE_URL;
const sslEnabled = process.env.DATABASE_SSL === "true";

const poolConfig: PoolConfig = {
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  database: process.env.DRIZZLE_DATABASE_NAME || "annetatargalt_donations",
  user: process.env.DATABASE_USERNAME || "strapi",
  password: process.env.DATABASE_PASSWORD || "strapi",
  min: parseInt(process.env.DATABASE_POOL_MIN || "2", 10),
  max: parseInt(process.env.DATABASE_POOL_MAX || "10", 10),
};

// Add SSL configuration if enabled (matching Strapi's config)
if (sslEnabled) {
  poolConfig.ssl = {
    rejectUnauthorized:
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}

// Use connection string if provided, otherwise use individual params
export const pool = connectionString
  ? new Pool({ connectionString, ...poolConfig })
  : new Pool(poolConfig);

// Create Drizzle instance with schema for relational queries
export const db = drizzle(pool, { schema });

// Type exports for dependency injection. `Database` covers both the pooled
// client and a transaction handle, so repositories can be constructed with
// either (e.g. `new DonationsRepository(tx)` inside `db.transaction(...)`).
export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Graceful shutdown handler
export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};
