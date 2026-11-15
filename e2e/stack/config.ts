import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where the tests' own stack runs. Its ports are next to the ones `pnpm dev`
 * uses, not on them, so a run never talks to the databases of development.
 */
export const PORTS = {
  backend: 1347,
  site: 3047,
  admin: 3048,
  fakes: 4047,
  smtp: 2547,
};

export const URLS = {
  backend: `http://127.0.0.1:${PORTS.backend}`,
  site: `http://localhost:${PORTS.site}`,
  admin: `http://localhost:${PORTS.admin}`,
  fakes: `http://127.0.0.1:${PORTS.fakes}`,
};

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** Files a run makes (the TLS certificate, the site's token, logs). */
export const STATE = join(ROOT, "e2e", ".state");
mkdirSync(STATE, { recursive: true });

/** The site's API token: the backend writes it here, the site reads it. */
export const TOKEN_FILE = join(STATE, "frontend.env");
/** The fake mail server's certificate, which the backend is told to trust. */
export const CERT_FILE = join(STATE, "smtp-cert.pem");
export const KEY_FILE = join(STATE, "smtp-key.pem");

/**
 * The Strapi admins the seed makes, who sign in to the admin panel too.
 * Strapi lets one address sign in only a few times in a few minutes, so each
 * test file that signs in has its own: the tests share the first one's
 * session.
 */
const admin = (name: string, firstname: string) => ({
  email: `${name}@e2e.test`,
  password: `E2e-${name}-password-1`,
  firstname,
  lastname: "Admin",
});
export const ADMINS = {
  shared: admin("admin", "Edda"),
  signIn: admin("sign-in", "Signe"),
  strapi: admin("strapi", "Stella"),
};

/** Montonio's keys for the fake: the backend signs with them, so does it. */
export const MONTONIO = {
  publicKey: "e2e-montonio-access-key",
  privateKey: "e2e-montonio-secret-key-that-is-long-enough",
};

/** The address the contact form's messages go to. */
export const TEAM_EMAIL = "team@e2e.test";

/**
 * The Postgres the stack uses, from the PG* variables like psql. Its two
 * databases are made anew on each start.
 */
export const DATABASE = {
  host: process.env.PGHOST ?? "127.0.0.1",
  port: process.env.PGPORT ?? "5432",
  user: process.env.PGUSER ?? process.env.USER ?? "postgres",
  password: process.env.PGPASSWORD ?? "",
  strapi: "annetatargalt_e2e_strapi",
  donations: "annetatargalt_e2e_donations",
};

/**
 * Everything the backend reads, set, so that nothing comes from
 * backend/.env: Strapi reads that file too, but never over a variable that's
 * already set, even to "". Google sign-in stays off, so passwords work, and
 * email goes to the fake mail server.
 */
export function backendEnv(): Record<string, string> {
  return {
    // Strapi reads the file this names instead of backend/.env, and it
    // doesn't exist.
    ENV_PATH: join(STATE, "no.env"),
    HOST: "127.0.0.1",
    PORT: String(PORTS.backend),
    FRONTEND_URL: URLS.site,
    CORS_ORIGINS: [URLS.site, URLS.admin].join(","),
    FRONTEND_ENV_FILE: TOKEN_FILE,
    FILE_STORAGE_DIR: join(STATE, "files"),
    APP_KEYS: "e2eKeyOne,e2eKeyTwo,e2eKeyThree,e2eKeyFour",
    API_TOKEN_SALT: "e2e-api-token-salt",
    ADMIN_JWT_SECRET: "e2e-admin-jwt-secret",
    TRANSFER_TOKEN_SALT: "e2e-transfer-token-salt",
    JWT_SECRET: "e2e-jwt-secret",
    CLOUDINARY_NAME: "",
    CLOUDINARY_KEY: "",
    CLOUDINARY_SECRET: "",
    DATABASE_CLIENT: "postgres",
    DATABASE_HOST: DATABASE.host,
    DATABASE_PORT: DATABASE.port,
    DATABASE_NAME: DATABASE.strapi,
    DATABASE_USERNAME: DATABASE.user,
    DATABASE_PASSWORD: DATABASE.password,
    DATABASE_SSL: "false",
    DATABASE_URL: "",
    DRIZZLE_DATABASE_NAME: DATABASE.donations,
    DRIZZLE_DATABASE_URL: "",
    MONTONIO_URL: URLS.fakes,
    MONTONIO_PUBLIC: MONTONIO.publicKey,
    MONTONIO_PRIVATE: MONTONIO.privateKey,
    MONTONIO_RETURN_URL: `${URLS.backend}/api`,
    MONTONIO_STORE_UUID: "",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(PORTS.smtp),
    SMTP_USERNAME: "e2e",
    SMTP_PASSWORD: "e2e",
    BREVO_DEFAULT_SENDER_EMAIL: "hello@e2e.test",
    BREVO_DEFAULT_REPLY_TO: "hello@e2e.test",
    NODE_EXTRA_CA_CERTS: CERT_FILE,
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    GOOGLE_WORKSPACE_DOMAIN: "",
    PREVIEW_SECRET: "e2e-preview-secret",
    SERVER_PROXY: "",
    INTERNAL_NETWORKS: "",
    EXTERNAL_RETURN_ORIGINS: "",
    STRAPI_TELEMETRY_DISABLED: "true",
    BROWSER: "none",
  };
}

export function siteEnv(token: string): Record<string, string> {
  return {
    PORT: String(PORTS.site),
    STRAPI_API_TOKEN: token,
    NEXT_PUBLIC_STRAPI_API_URL: URLS.backend,
    NEXT_PUBLIC_SITE_URL: URLS.site,
    PLAUSIBLE_DOMAIN: "",
    UMAMI_WEBSITE_ID: "",
    PREVIEW_SECRET: "e2e-preview-secret",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

export function adminEnv(): Record<string, string> {
  return {
    PORT: String(PORTS.admin),
    STRAPI_URL: URLS.backend,
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    GOOGLE_WORKSPACE_DOMAIN: "",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
