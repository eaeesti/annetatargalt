#!/usr/bin/env node
/**
 * A copy of the site's content for working on the code locally: the Strapi
 * database with everything private taken out.
 *
 *   pnpm snapshot:make <dump.sql[.gz]> [snapshot.sql.gz]   (a maintainer)
 *   pnpm snapshot:load <snapshot.sql.gz>                   (anyone)
 *
 * make takes a plain-SQL dump of the production Strapi database
 * (pg_dump --no-owner --no-privileges, gzipped or not), loads it into a
 * scratch database beside yours, removes what's private (SCRUB below) and
 * dumps what's left. The donations are in another database, which this never
 * touches: a snapshot has pages, organizations and texts, and no donors.
 *
 * load puts a snapshot into the database DATABASE_NAME names, keeping one
 * that's already there under another name, then creates the donations
 * database (DRIZZLE_DATABASE_NAME) if it's missing and applies its
 * migrations. Stop Strapi first.
 *
 * Both read the connection settings from backend/.env and need Postgres's
 * command-line tools (psql, pg_dump, createdb, dropdb).
 */

import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { createGunzip, createGzip } from "node:zlib";

/**
 * What a snapshot leaves out. Anyone who adds a content type or table that
 * holds personal data, an account or a secret adds it here too.
 */
const SCRUB = `
BEGIN;

-- Tables that may not exist in every Strapi version are emptied if they do.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- Messages people sent through the contact form
    'contact_submissions',
    -- Accounts and sign-ins: the editors in Strapi's admin and the admin
    -- panel's users. Whoever loads the snapshot makes their own.
    'admin_users',
    'up_users',
    'strapi_sessions',
    -- Keys. Strapi makes the site's API token again when it starts.
    'strapi_api_tokens',
    'strapi_api_token_permissions',
    'strapi_transfer_tokens',
    'strapi_transfer_token_permissions',
    -- Who changed what, and earlier versions of entries
    'strapi_audit_logs',
    'strapi_history_versions',
    -- Addresses elsewhere, which may carry secrets
    'strapi_webhooks'
  ] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM %I', t);
    END IF;
  END LOOP;
END $$;

-- The team's own addresses, where contact form messages are sent
UPDATE email_configs
SET contact_form_submission_recipients = 'team@example.org';

-- Sign-in providers' keys and secrets
UPDATE strapi_core_store_settings
SET value = (
  SELECT jsonb_object_agg(
    provider,
    (
      SELECT jsonb_object_agg(
        field,
        CASE WHEN field IN ('key', 'secret') THEN '""'::jsonb ELSE setting END
      )
      FROM jsonb_each(settings) AS s(field, setting)
    )
  )
  FROM jsonb_each(value::jsonb) AS p(provider, settings)
)::text
WHERE key = 'plugin_users-permissions_grant';

COMMIT;
`;

/** What's left of the private rows after SCRUB: all of it must be zero. */
const LEFT_OVER = `
SELECT
  (SELECT count(*) FROM contact_submissions)
  + (SELECT count(*) FROM admin_users)
  + (SELECT count(*) FROM up_users)
  + (SELECT count(*) FROM strapi_sessions)
  + (SELECT count(*) FROM strapi_api_tokens)
  + (SELECT count(*) FROM strapi_transfer_tokens)
`;

function setting(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} isn't set: run this from backend with pnpm.`);
  }
  return value;
}

/**
 * Postgres's tools find the server and the password in the environment, so
 * the password never appears in a command line.
 */
function postgresEnvironment() {
  return {
    ...process.env,
    PGHOST: process.env.DATABASE_HOST ?? "127.0.0.1",
    PGPORT: process.env.DATABASE_PORT ?? "5432",
    ...(process.env.DATABASE_USERNAME && {
      PGUSER: process.env.DATABASE_USERNAME,
    }),
    ...(process.env.DATABASE_PASSWORD && {
      PGPASSWORD: process.env.DATABASE_PASSWORD,
    }),
    ...(process.env.DATABASE_SSL === "true" && { PGSSLMODE: "require" }),
  };
}

/**
 * Runs a command and resolves with what it printed, or rejects when it
 * fails. `input` is streamed to it, and `output`, a chain of streams, takes
 * what it prints instead.
 */
function run(command, args, { input, output } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: postgresEnvironment(),
      stdio: [input ? "pipe" : "ignore", "pipe", "inherit"],
    });
    let printed = "";
    if (!output) child.stdout.on("data", (chunk) => (printed += chunk));
    // Settles with the streams' error, if any, once both are done. A
    // command that fails stops reading, which breaks its input's pipe:
    // then the command's own failure is the one to report.
    const streamed = Promise.all([
      output ? pipeline(child.stdout, ...output) : undefined,
      input ? pipeline(input, child.stdin) : undefined,
    ]).then(
      () => null,
      (error) => error,
    );
    child.on("error", reject);
    child.on("close", (code) => {
      streamed.then((error) => {
        if (code !== 0) {
          reject(new Error(`${command} failed (exit code ${code})`));
        } else if (error) reject(error);
        else resolve(printed.trim());
      });
    });
  });
}

function sql(database, statement) {
  return run("psql", [
    "-X",
    "-q",
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
    "-d",
    database,
    "-c",
    statement,
  ]);
}

/**
 * Feeds a dump file, gzipped or not, to psql. A dump from a newer pg_dump
 * than the local Postgres has lines the older psql doesn't know, which are
 * left out: Postgres 17's \restrict and its transaction_timeout setting.
 */
async function restore(database, file) {
  const read = createReadStream(file);
  const unzipped = file.endsWith(".gz") ? read.pipe(createGunzip()) : read;
  const input = unzipped.pipe(
    withoutLines(/^\\(un)?restrict |^SET transaction_timeout/),
  );
  await run(
    "psql",
    ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", database, "-o", "/dev/null"],
    { input },
  );
}

/** A stream of text without the lines `drop` matches. */
function withoutLines(drop) {
  let rest = "";
  return new Transform({
    transform(chunk, _encoding, done) {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop() ?? "";
      const kept = lines.filter((line) => !drop.test(line));
      done(null, kept.map((line) => line + "\n").join(""));
    },
    flush(done) {
      done(null, drop.test(rest) ? "" : rest);
    },
  });
}

async function databases() {
  const names = await sql("postgres", "SELECT datname FROM pg_database");
  return names.split("\n");
}

function quoted(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function timestamp() {
  return new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[-:]/g, "")
    .replace("T", "_");
}

async function make(dump, out = `content-snapshot-${timestamp()}.sql.gz`) {
  if (!dump) throw new Error("Which dump? pnpm snapshot:make <dump.sql.gz>");
  const scratch = `${setting("DATABASE_NAME")}_snapshot_${timestamp()}`;
  await run("createdb", [scratch]);
  try {
    console.log(`Loading ${dump} into ${scratch}…`);
    await restore(scratch, dump);
    await sql(scratch, SCRUB);
    if ((await sql(scratch, LEFT_OVER)) !== "0") {
      throw new Error("Private rows were left after scrubbing; no snapshot.");
    }
    await run("pg_dump", ["--no-owner", "--no-privileges", "-d", scratch], {
      output: [createGzip(), createWriteStream(out)],
    });
    console.log(`Snapshot written to ${out}`);
  } finally {
    await run("dropdb", [scratch]);
  }
}

async function load(snapshot) {
  if (!snapshot) {
    throw new Error("Which snapshot? pnpm snapshot:load <snapshot.sql.gz>");
  }
  const target = setting("DATABASE_NAME");
  const donations = setting("DRIZZLE_DATABASE_NAME");
  const existing = await databases();

  let kept = null;
  if (existing.includes(target)) {
    kept = `${target}_before_${timestamp()}`;
    // Fails while Strapi is connected to it.
    await sql(
      "postgres",
      `ALTER DATABASE ${quoted(target)} RENAME TO ${quoted(kept)}`,
    );
  }
  await run("createdb", [target]);
  try {
    console.log(`Loading ${snapshot} into ${target}…`);
    await restore(target, snapshot);
  } catch (error) {
    await run("dropdb", [target]);
    if (kept) {
      await sql(
        "postgres",
        `ALTER DATABASE ${quoted(kept)} RENAME TO ${quoted(target)}`,
      );
    }
    throw error;
  }

  if (!existing.includes(donations)) await run("createdb", [donations]);
  console.log(`Applying the donations database's migrations…`);
  await new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "drizzle-kit", "migrate"], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(undefined)
        : reject(new Error(`drizzle-kit migrate failed (exit code ${code})`)),
    );
  });

  console.log(`
Done.${kept ? ` Your earlier database is kept as ${kept}; drop it once you don't need it.` : ""}
Start everything with pnpm dev in the repository's root, then open
http://localhost:1337/admin and register: a snapshot has no accounts, so the
first one you make is a Super Admin. Strapi writes the site's API token into
frontend/.env as it starts.`);
}

const [command, ...args] = process.argv.slice(2);
const commands = { make, load };

if (command !== "make" && command !== "load") {
  console.error("Usage: content-snapshot.mjs make|load <file>");
  process.exit(1);
}
commands[command](...args).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
