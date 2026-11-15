// The tests' site or admin panel (the argument says which): built, unless
// E2E_SKIP_BUILD is set, and started like in production.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TOKEN_FILE, adminEnv, siteEnv } from "./config.ts";

const app = process.argv[2];
if (app !== "site" && app !== "admin") {
  throw new Error("Say which: site or admin");
}

/** The token the backend wrote when it made it, on its first start. */
function siteToken() {
  const line = readFileSync(TOKEN_FILE, "utf8")
    .split("\n")
    .find((l) => l.startsWith("STRAPI_API_TOKEN="));
  if (!line) throw new Error(`No site token in ${TOKEN_FILE}`);
  return line.slice("STRAPI_API_TOKEN=".length);
}

const dir = join(ROOT, app === "site" ? "frontend" : "admin");
const env = {
  ...process.env,
  ...(app === "site" ? siteEnv(siteToken()) : adminEnv()),
};

if (!process.env.E2E_SKIP_BUILD) {
  execFileSync("pnpm", ["build"], { cwd: dir, env, stdio: "inherit" });
}
// next itself rather than through pnpm, which doesn't pass a stop signal on.
const next = join(dir, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [next, "start", "--port", env.PORT], {
  cwd: dir,
  env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 1)); // a signal is a failure
