// Seeds the tests' content into a new database and starts Strapi. Run by
// backend.mjs, in the backend's folder and with its settings.
import { createRequire } from "node:module";
import { join } from "node:path";
import { seed } from "./seed.mjs";

const backendDir = process.cwd();
const require = createRequire(join(backendDir, "package.json"));
const { createStrapi } = require("@strapi/strapi");
const strapi = createStrapi({
  appDir: backendDir,
  distDir: join(backendDir, "dist"),
});
await strapi.load();
await seed(strapi);
await strapi.start();
