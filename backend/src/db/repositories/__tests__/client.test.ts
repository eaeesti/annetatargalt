/**
 * Integration test for the donations database's connection pool. It isn't a
 * repository, but it needs the test database, which only the tests in this
 * folder get.
 */

import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { db, pool } from "../../client";

describe("the connection pool", () => {
  it("survives Postgres dropping its idle connections, as a restart does", async () => {
    // Two queries at once leave two idle connections in the pool
    await Promise.all([db.execute(sql`select 1`), db.execute(sql`select 1`)]);
    expect(pool.idleCount).toBeGreaterThan(0);

    // A session of its own ends them. An error event nothing listens for
    // would end the process here, failing the run.
    const admin = new Client(pool.options);
    await admin.connect();
    const ended = await admin.query(
      `select pg_terminate_backend(pid) from pg_stat_activity
       where datname = current_database() and pid <> pg_backend_pid()
         and usename = current_user and state = 'idle'`,
    );
    await admin.end();
    expect(ended.rowCount).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const result = await db.execute<{ ok: number }>(sql`select 2 as ok`);
    expect(result.rows[0]?.ok).toBe(2);
  });
});
