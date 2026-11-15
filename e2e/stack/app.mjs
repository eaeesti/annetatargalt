// The tests' site or admin panel (the argument says which): built, unless
// E2E_SKIP_BUILD is set, and started like in production.
import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";
import { ROOT, adminEnv, siteEnv } from "./config.ts";

const app = process.argv[2];
if (app !== "site" && app !== "admin") {
  throw new Error("Say which: site or admin");
}

const dir = join(ROOT, app === "site" ? "frontend" : "admin");
const env = {
  ...process.env,
  ...(app === "site" ? siteEnv() : adminEnv()),
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
server.on("exit", (code) => process.exit(code ?? 0));
