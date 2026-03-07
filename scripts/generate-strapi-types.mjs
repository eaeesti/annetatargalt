#!/usr/bin/env node
/**
 * scripts/generate-strapi-types.mjs
 *
 * Reads Strapi schema.json files from backend/src and generates TypeScript
 * interfaces to frontend/src/types/generated/strapi.ts.
 *
 * Run manually:  node scripts/generate-strapi-types.mjs
 * Auto-runs via: predevelop / prebuild hooks in backend/package.json
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const backendSrc = path.join(repoRoot, "backend", "src");
const outputDir = path.join(repoRoot, "frontend", "src", "types", "generated");
const outputFile = path.join(outputDir, "strapi.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

function findJsonFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findJsonFiles(full));
    else if (entry.name.endsWith(".json")) results.push(full);
  }
  return results;
}

function toPascalCase(str) {
  return str
    .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (c) => c.toUpperCase());
}

function displayNameToInterfaceName(displayName) {
  // displayName may already be PascalCase ("DonationSection") or have spaces ("Footer Column")
  return "Strapi" + toPascalCase(displayName.replace(/\s+/g, ""));
}

// ── Step 1: Read all schemas ──────────────────────────────────────────────────

const componentDir = path.join(backendSrc, "components");
const apiDir = path.join(backendSrc, "api");

const componentFiles = findJsonFiles(componentDir);
const contentTypeFiles = findJsonFiles(apiDir).filter((f) =>
  f.includes("content-types"),
);

// ── Step 2: Build UID → interface name maps ───────────────────────────────────

/** @type {Map<string, string>} uid → interface name */
const uidToName = new Map();
/** @type {Map<string, object>} uid → parsed schema */
const componentSchemas = new Map();
/** @type {Map<string, object>} uid → parsed schema */
const contentTypeSchemas = new Map();

for (const file of componentFiles) {
  const schema = JSON.parse(readFileSync(file, "utf8"));
  // Derive UID from path relative to components dir:
  // "meta/metadata.json" → "meta.metadata"
  // "special-sections/entity-text-section.json" → "special-sections.entity-text-section"
  const rel = path.relative(componentDir, file);
  const parts = rel.split(path.sep);
  const category = parts[0];
  const name = parts[parts.length - 1].replace(".json", "");
  const uid = `${category}.${name}`;

  uidToName.set(uid, displayNameToInterfaceName(schema.info.displayName));
  componentSchemas.set(uid, schema);
}

for (const file of contentTypeFiles) {
  const schema = JSON.parse(readFileSync(file, "utf8"));
  const { singularName } = schema.info;
  // Strapi content type UID format: "api::singular-name.singular-name"
  const uid = `api::${singularName}.${singularName}`;

  uidToName.set(uid, displayNameToInterfaceName(schema.info.displayName));
  contentTypeSchemas.set(uid, schema);
}

// ── Step 3: Collect all dynamic zone component UIDs ───────────────────────────

/** UIDs that appear in at least one dynamic zone (get __component discriminant) */
const dynamicZoneUids = new Set();

for (const schema of contentTypeSchemas.values()) {
  for (const attr of Object.values(schema.attributes ?? {})) {
    if (attr.type === "dynamiczone") {
      for (const uid of attr.components ?? []) {
        dynamicZoneUids.add(uid);
      }
    }
  }
}

// ── Step 4: Type mapping ──────────────────────────────────────────────────────

function attrToType(attr) {
  switch (attr.type) {
    case "string":
    case "text":
    case "richtext":
    case "uid":
    case "email":
    case "password":
      return "string | null";

    case "integer":
    case "biginteger":
    case "float":
    case "decimal":
      return "number | null";

    case "boolean":
      return "boolean | null";

    case "date":
    case "datetime":
    case "time":
      return "string | null";

    case "json":
    case "blocks":
      return "unknown";

    case "enumeration":
      return attr.enum.map((v) => `"${v}"`).join(" | ") + " | null";

    case "media":
      return attr.multiple ? "StrapiMedia[]" : "StrapiMedia | null";

    case "component": {
      const name = uidToName.get(attr.component) ?? "unknown";
      return attr.repeatable ? `${name}[]` : `${name} | null`;
    }

    case "relation": {
      const name = uidToName.get(attr.target) ?? "unknown";
      const isMany = ["oneToMany", "manyToMany", "morphMany"].includes(
        attr.relation,
      );
      return isMany ? `${name}[]` : `${name} | null`;
    }

    case "dynamiczone":
      // All dynamic zones in this project use the shared StrapiSection union
      return "StrapiSection[]";

    default:
      return "unknown";
  }
}

// ── Step 5: Interface body generator ─────────────────────────────────────────

function generateInterfaceBody(schema, { uid, isContentType = false }) {
  const lines = [];

  lines.push("  id: number;");

  if (isContentType) {
    lines.push("  documentId: string;");
  }

  // Dynamic zone members get a __component discriminant
  if (dynamicZoneUids.has(uid)) {
    lines.push(`  __component: "${uid}";`);
  }

  for (const [name, attr] of Object.entries(schema.attributes ?? {})) {
    lines.push(`  ${name}: ${attrToType(attr)};`);
  }

  if (isContentType) {
    lines.push("  createdAt: string | null;");
    lines.push("  updatedAt: string | null;");
    if (schema.options?.draftAndPublish) {
      lines.push("  publishedAt: string | null;");
    }
  }

  return lines.join("\n");
}

// ── Step 6: Collect all dynamic zone UIDs for the StrapiSection union ─────────

// Gather every unique component UID referenced in any dynamic zone, preserving
// insertion order for a stable output.
const allSectionUids = [...dynamicZoneUids];

// ── Step 7: Assemble output ───────────────────────────────────────────────────

const out = [];

out.push(
  "// Auto-generated by scripts/generate-strapi-types.mjs",
  "// Do not edit manually — re-run `yarn generate-types` after changing Strapi schemas.",
  "",
);

// Base types
out.push(
  "// ─────────────────────────────────────────────",
  "// Base types",
  "// ─────────────────────────────────────────────",
  "",
  "export interface StrapiMedia {",
  "  id: number;",
  "  documentId: string;",
  "  url: string;",
  "  alternativeText: string | null;",
  "  width: number | null;",
  "  height: number | null;",
  "  formats: Record<string, unknown> | null;",
  "  name: string | null;",
  "  mime: string | null;",
  "  size: number | null;",
  "}",
  "",
);

// Component interfaces
out.push(
  "// ─────────────────────────────────────────────",
  "// Components",
  "// ─────────────────────────────────────────────",
  "",
);

for (const [uid, schema] of componentSchemas) {
  const name = uidToName.get(uid);
  out.push(
    `export interface ${name} {`,
    generateInterfaceBody(schema, { uid }),
    "}",
    "",
  );
}

// StrapiSection union — all components that appear in any dynamic zone
if (allSectionUids.length > 0) {
  out.push(
    "// ─────────────────────────────────────────────",
    "// Section union (all dynamic zone components)",
    "// ─────────────────────────────────────────────",
    "",
    "export type StrapiSection =",
  );
  for (let i = 0; i < allSectionUids.length; i++) {
    const name = uidToName.get(allSectionUids[i]) ?? "unknown";
    const isLast = i === allSectionUids.length - 1;
    out.push(`  | ${name}${isLast ? ";" : ""}`);
  }
  out.push("");
}

// Content type interfaces
out.push(
  "// ─────────────────────────────────────────────",
  "// Content types",
  "// ─────────────────────────────────────────────",
  "",
);

for (const [uid, schema] of contentTypeSchemas) {
  const name = uidToName.get(uid);
  out.push(
    `export interface ${name} {`,
    generateInterfaceBody(schema, { uid, isContentType: true }),
    "}",
    "",
  );
}

// ── Step 8: Write output ──────────────────────────────────────────────────────

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputFile, out.join("\n"));

const rel = path.relative(repoRoot, outputFile);
console.log(`✅  Generated Strapi types → ${rel}`);
