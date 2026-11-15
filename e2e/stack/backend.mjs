// The tests' backend: makes its two databases anew, builds the backend
// (unless E2E_SKIP_BUILD is set) and creates the donations tables. Then
// strapi.mjs seeds the content and starts Strapi, in a process of its own:
// Node reads NODE_EXTRA_CA_CERTS, which lets it trust the fake mail server,
// only when a process starts.
import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { DATABASE, ROOT, STATE, TOKEN_FILE, backendEnv } from "./config.ts";

const backendDir = join(ROOT, "backend");
const env = {
  ...process.env,
  ...backendEnv(),
  PGHOST: DATABASE.host,
  PGPORT: DATABASE.port,
  PGUSER: DATABASE.user,
  PGPASSWORD: DATABASE.password,
};
const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", env, ...options });

for (const database of [DATABASE.strapi, DATABASE.donations]) {
  run("dropdb", ["--if-exists", "--force", database]);
  run("createdb", [database]);
}
rmSync(TOKEN_FILE, { force: true });
rmSync(join(STATE, "files"), { recursive: true, force: true });

if (!process.env.E2E_SKIP_BUILD) run("pnpm", ["build"], { cwd: backendDir });
run("pnpm", ["exec", "drizzle-kit", "migrate"], { cwd: backendDir });

const strapi = spawn(
  process.execPath,
  [join(ROOT, "e2e", "stack", "strapi.mjs")],
  { cwd: backendDir, env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => strapi.kill(signal));
}
strapi.on("exit", (code) => process.exit(code ?? 1)); // a signal is a failure
