/**
 * Apply the donations database's pending migrations: the migrator
 * `drizzle-kit migrate` runs, with the same folder and the same
 * drizzle.__drizzle_migrations table, but without drizzle-kit, which is a
 * development dependency and not in the production image. Run it from the
 * backend folder with the database settings in the environment:
 *
 *   node dist/src/scripts/migrate.js
 *
 * All pending migrations are applied in one transaction, so a failing one
 * leaves the database as it was.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../db/client";

async function main() {
  try {
    await migrate(db, { migrationsFolder: "src/db/migrations" });
    console.log("[migrate] migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});
