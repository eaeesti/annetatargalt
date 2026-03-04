"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.db = exports.pool = void 0;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = __importStar(require("./schema"));
// Database configuration from environment variables
// NOTE: Drizzle uses a SEPARATE database from Strapi for clean separation
const connectionString = process.env.DRIZZLE_DATABASE_URL;
const sslEnabled = process.env.DATABASE_SSL === "true";
const poolConfig = {
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
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
    };
}
// Use connection string if provided, otherwise use individual params
exports.pool = connectionString
    ? new pg_1.Pool({ connectionString, ...poolConfig })
    : new pg_1.Pool(poolConfig);
// Create Drizzle instance with schema for relational queries
exports.db = (0, node_postgres_1.drizzle)(exports.pool, { schema });
// Graceful shutdown handler
const closeDatabase = async () => {
    await exports.pool.end();
};
exports.closeDatabase = closeDatabase;
