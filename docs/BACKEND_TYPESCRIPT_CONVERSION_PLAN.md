# Backend TypeScript Conversion Plan

## Progress Update (March 7, 2026)

### Completed Phases ✅
- **Phase 0**: TypeScript infrastructure setup - DONE
- **Phase 1**: Database schema & client conversion - DONE
- **Phase 2**: Test helpers & utilities conversion - DONE
- **Phase 3**: All 7 repositories converted - DONE
- **Phase 4**: All API controllers, services, and lifecycles converted - DONE
- **Phase 5**: Donations plugin conversion - DONE
- **Phase 6**: All API routes converted - DONE (12 route files)
- **Phase 7**: `src/index.ts` converted - DONE

- **Phase 8**: Test migration - DONE
- **Phase 9**: Strict mode - DONE

### All Phases Complete 🎉

**Status:** 10 out of 10 phases complete. Full TypeScript conversion finished.

`yarn type-check` passes with `strict: true`. 44 unit tests passing.

### Phase 5 Results

All 9 plugin files converted to TypeScript. Same `export default` pattern as API files. `src/plugins/**` removed from tsconfig exclude — plugins now compiled by Strapi to `dist/` like all other files. Generated `.js` files in `src/db/` and `src/utils/` permanently deleted.

### How Phase 4 Was Solved

Initial attempts failed because we used the wrong tsconfig approach (`noEmit: true`, custom extends). The fix was to follow the [official Strapi TypeScript documentation](https://docs.strapi.io/cms/typescript/adding-support-to-existing-project):

**Key configuration changes:**
- Switch `tsconfig.json` to extend `@strapi/typescript-utils/tsconfigs/server`
- Set `outDir: "dist"` — Strapi compiles TypeScript to `dist/` before loading
- Add `src/admin/tsconfig.json` extending `@strapi/typescript-utils/tsconfigs/admin`
- Use `export default` syntax (standard ESM, not `export =`)

**What Strapi does during `yarn develop`:**
1. Compiles all `.ts` files to `dist/` directory
2. Loads modules from `dist/` (not from `src/`)
3. Hot-reloads on `.ts` file changes

**Phase 4 files converted:**
- 11 services (6 simple wrappers + cause, organization with custom methods)
- 10 controllers (7 simple wrappers + contact-submission, email-config, donation proxy)
- 1 lifecycle hook (organization before-delete guards with Drizzle queries)

All endpoints verified working after conversion. `yarn type-check` passes.

---


## Executive Summary

Convert the Strapi v5 backend from JavaScript to TypeScript incrementally, starting with the data layer and working outward. The backend has 65 JavaScript files organized in clear layers with existing Strapi-generated types and Vitest tests ready for conversion.

**Approach:** Bottom-up migration (database → repositories → services → controllers → routes)

**Why this order:**
- Database schema types flow through the entire application
- Repositories depend on schema types
- Services depend on repository types
- Controllers consume service types
- Frontend can eventually consume backend API types

**Total Effort:** ~4-6 weeks (incremental, can pause between phases)

---

## Current State

### Assets
- ✅ 65 JavaScript files to convert
- ✅ Strapi v5 auto-generates TypeScript types (`types/generated/contentTypes.d.ts`)
- ✅ Vitest test suite (91 tests passing)
- ✅ Drizzle ORM (excellent TypeScript support)
- ✅ `jsconfig.json` with basic compiler options
- ✅ `@types/pg` already installed

### Gaps
- ❌ No `tsconfig.json` (only jsconfig)
- ❌ No `typescript` package installed
- ❌ No `@types/node` for Node.js types
- ❌ Tests use `.test.js` (not `.test.ts`)
- ❌ No type checking in CI/CD

---

## File Conversion Inventory

**Total files:** 65 JavaScript files in src/ directory

**By category:**
1. **Core Infrastructure** (3 files): `index.js`, `db/client.js`, `db/schema.js`
2. **Repositories** (7 files): All files in `db/repositories/`
3. **Plugin Services** (7 files): Custom donations plugin
4. **API Content Types** (28 files): Strapi CRUD controllers/services
5. **Utilities** (6 files): Helper functions in `utils/`
6. **Tests** (6 files): Unit and integration tests
7. **Examples** (2 files): Admin configuration examples

**Largest file:** `plugins/donations/server/services/donation.js` (1,306 lines)

---

## Implementation Strategy

### Phase 0: Infrastructure Setup (2-3 hours) ✅ COMPLETED

**Goal:** Configure TypeScript tooling without breaking existing JavaScript code.

**Key Discovery:** Strapi v5 has built-in TypeScript compilation! The `tsconfig.json` is used for type checking only (`noEmit: true`), while Strapi handles the actual compilation during `yarn develop`.

#### Install Dependencies

```bash
cd backend
yarn add -D typescript @types/node ts-node @tsconfig/node18
```

#### Create tsconfig.json

**Critical:** Use `noEmit: true` and exclude `.js` files to enable .js/.ts coexistence:

```json
{
  "extends": "@tsconfig/node18/tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "~/*": ["src/*"]
    },
    "types": ["node"],
    "typeRoots": ["./node_modules/@types", "./types"]
  },
  "include": ["src/**/*.ts", "types/**/*"],
  "exclude": ["node_modules", "dist", ".strapi", "build", "src/**/*.js"]
}
```

**Why these settings:**
- `noEmit: true` - Type checking only, Strapi compiles TypeScript internally
- `module: "CommonJS"` - Match Strapi's module system
- `include: ["src/**/*.ts", ...]` - Only type-check TypeScript files
- `exclude: [..., "src/**/*.js"]` - Ignore JavaScript files during type checking
- This allows `.js` and `.ts` files to coexist during incremental migration!

#### Add Scripts

**File:** `backend/package.json`

```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "type-check:watch": "tsc --noEmit --watch"
  }
}
```

#### Update Vitest Config

**Rename:** `vitest.config.js` → `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.{js,ts}"],
    fileParallelism: process.env.INTEGRATION_TESTS !== "true",
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{js,ts}"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.{js,ts}", "src/admin/**"],
    },
  },
});
```

#### Verification

```bash
yarn type-check  # Should run without errors
yarn test:unit   # All tests should pass
yarn develop     # Strapi should boot
```

---

### Phase 1: Database Schema & Client (4-6 hours) ✅ COMPLETED

**Goal:** Convert foundational data layer to TypeScript.

**Migration Strategy:** During incremental migration, both `.js` and `.ts` files coexist:
- `.ts` files contain the TypeScript version with full type exports
- `.js` files remain for existing code that uses `require()`
- Strapi compiles both during development
- Once all dependent files are converted, `.js` files can be deleted

#### Files Converted

1. ✅ `src/db/schema.ts` - TypeScript version with Drizzle type exports
2. ✅ `src/db/client.ts` - TypeScript version with typed Pool and Database
3. ✅ `src/db/repositories/index.ts` - ESM exports

**Note:** Original `.js` files kept temporarily for compatibility with existing code.

#### Example: Schema Conversion

**Before (schema.js):**
```javascript
const { pgTable, serial, varchar } = require("drizzle-orm/pg-core");

const donors = pgTable("donors", {
  id: serial("id").primaryKey(),
  idCode: varchar("id_code", { length: 11 }),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }),
});

module.exports = { donors, donations };
```

**After (schema.ts):**
```typescript
import { pgTable, serial, varchar, integer, timestamp, numeric } from "drizzle-orm/pg-core";

export const donors = pgTable("donors", {
  id: serial("id").primaryKey(),
  idCode: varchar("id_code", { length: 11 }),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const donations = pgTable("donations", {
  id: serial("id").primaryKey(),
  donorId: integer("donor_id").references(() => donors.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  // ...
});

// Type exports
export type Donor = typeof donors.$inferSelect;
export type NewDonor = typeof donors.$inferInsert;
export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;
```

**Benefits:**
- Drizzle auto-infers types from schema
- `$inferSelect` gives row type
- `$inferInsert` gives insert payload type

#### Example: Client Conversion

**After (client.ts):**
```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DRIZZLE_DATABASE_NAME,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
export { pool };
```

#### Verification (Phase 0 & 1)

```bash
yarn type-check  # ✅ Passes (0 errors)
yarn test:unit   # ✅ All 44 tests passing
yarn develop     # ✅ Strapi boots successfully (3.5s)
```

**Status:** Infrastructure ready, database layer has TypeScript versions available!

---

### Phase 2: Test Helpers & Utilities (3-4 hours)

**Goal:** Convert test infrastructure and utility functions.

#### Files to Convert

1. `src/db/__tests__/test-db-helper.js` → `.ts` (163 lines)
2. `src/utils/donation.js` → `.ts` (83 lines)
3. `src/utils/organization-resolver.js` → `.ts` (110 lines)
4. `src/utils/banks.js` → `.ts` (71 lines)
5. `src/utils/montonio.js` → `.ts` (45 lines)
6. `src/utils/string.js` → `.ts` (50 lines)
7. `src/utils/estonia.js` → `.ts`

#### Example: Test Helper Conversion

**After (test-db-helper.ts):**
```typescript
import { db } from "../client";
import { donors, donations, type NewDonor, type Donor } from "../schema";

export async function createTestDonor(data: Partial<NewDonor> = {}): Promise<Donor> {
  const [donor] = await db
    .insert(donors)
    .values({
      idCode: "12345678901",
      email: "test@example.com",
      name: "Test Donor",
      ...data,
    })
    .returning();
  return donor!;
}

export async function cleanDatabase(): Promise<void> {
  await db.delete(donations);
  await db.delete(donors);
}
```

---

### Phase 3: Repositories (6-8 hours)

**Goal:** Convert data access layer with full type safety.

#### Files to Convert

1. `src/db/repositories/donations.repository.js` → `.ts` (355 lines)
2. `src/db/repositories/donors.repository.js` → `.ts` (112 lines)
3. `src/db/repositories/recurring-donations.repository.js` → `.ts` (152 lines)
4. `src/db/repositories/organization-donations.repository.js` → `.ts` (112 lines)
5. `src/db/repositories/organization-recurring-donations.repository.js` → `.ts` (126 lines)
6. `src/db/repositories/donation-transfers.repository.js` → `.ts` (94 lines)

#### Example: Repository Conversion

**After (donors.repository.ts):**
```typescript
import { db, type Database } from "../client";
import { donors, type Donor, type NewDonor } from "../schema";
import { eq, or } from "drizzle-orm";

export class DonorsRepository {
  constructor(private database: Database = db) {}

  async findById(id: number): Promise<Donor | undefined> {
    return this.database.query.donors.findFirst({
      where: eq(donors.id, id),
    });
  }

  async create(data: NewDonor): Promise<Donor> {
    const [donor] = await this.database.insert(donors).values(data).returning();
    return donor!;
  }

  async update(id: number, data: Partial<NewDonor>): Promise<Donor | undefined> {
    const [updated] = await this.database
      .update(donors)
      .set(data)
      .where(eq(donors.id, id))
      .returning();
    return updated;
  }
}

export const donorsRepository = new DonorsRepository();
```

---

### Phase 4: Strapi Services & Lifecycle Hooks (4-6 hours)

**Goal:** Convert Strapi content-type services and lifecycle hooks.

#### Files to Convert

1. `src/api/organization/services/organization.js` → `.ts` (42 lines)
2. `src/api/organization/content-types/organization/lifecycles.js` → `.ts` (70 lines)
3. `src/api/cause/services/cause.js` → `.ts`
4. `src/api/contact-submission/controllers/contact-submission.js` → `.ts` (56 lines)
5. All other API services in `src/api/*/services/*.js`

#### Strapi Typing Pattern

**After (organization.service.ts):**
```typescript
import type { Core } from "@strapi/strapi";

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async findWithInternalId(internalId: string): Promise<any | null> {
    const orgs = await strapi.documents("api::organization.organization").findMany({
      filters: { internalId: { $eq: internalId } },
    });
    return orgs.length > 0 ? orgs[0] : null;
  },
});
```

---

### Phase 5: Plugin Services & Controllers ✅ COMPLETED

**Goal:** Convert custom donations plugin to TypeScript.

All 9 files converted using `export default` with `({ strapi }: any) => ({})`. Removed `src/plugins/**` from tsconfig exclude. Generated `.js` files in `src/db/` and `src/utils/` permanently deleted.

---

### Phase 6: Controllers & Routes ✅ COMPLETED

**Goal:** Type HTTP request handlers and route definitions. All 12 route files converted. Core routers use `factories.createCoreRouter()`, custom routes use plain `export default { routes: [...] }`.

---

### Phase 7: Core Files & Bootstrap ✅ COMPLETED

**Goal:** Type application initialization and lifecycle. `src/index.ts` converted — uses `import type { Core } from "@strapi/strapi"` and `export default { register, bootstrap }`.

---

### Phase 8: Test Migration (4-6 hours)

**Goal:** Convert all test files to TypeScript.

Tests remain structurally identical, just add types:

**After:**
```typescript
import { describe, it, expect } from "vitest";
import type { Organization } from "../../../types/generated/contentTypes";

describe("OrganizationResolver", () => {
  it("should resolve organization by internalId", async () => {
    const org: Organization | null = await resolver.resolve("AMF");
    expect(org).toBeDefined();
    expect(org?.internalId).toBe("AMF");
  });
});
```

---

### Phase 9: Strict Mode & Refinement (2-4 hours)

**Goal:** Enable stricter TypeScript checks and fix issues.

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

---

## Verification Strategy

### After Each Phase

```bash
yarn type-check  # Fewer errors with each phase
yarn test:unit   # All tests should pass
yarn test:integration  # Repository tests should pass
yarn develop     # Strapi should boot
yarn build       # Admin panel should build
```

### End-to-End Verification

```bash
yarn type-check  # 0 errors
yarn test:all    # All 91 tests pass
yarn develop     # Test in browser
NODE_ENV=production yarn build && yarn start  # Production works
```

---

## Timeline & Effort Estimate

| Phase | Description | Effort | Cumulative |
|-------|-------------|--------|------------|
| 0 | Infrastructure Setup | 2-3 hours | 3 hours |
| 1 | Database Schema & Client | 4-6 hours | 9 hours |
| 2 | Test Helpers & Utilities | 3-4 hours | 13 hours |
| 3 | Repositories | 6-8 hours | 21 hours |
| 4 | Strapi Services | 4-6 hours | 27 hours |
| 5 | Plugin Services | 8-10 hours | 37 hours |
| 6 | Controllers & Routes | 4-6 hours | 43 hours |
| 7 | Core Files | 2-3 hours | 46 hours |
| 8 | Test Migration | 4-6 hours | 52 hours |
| 9 | Strict Mode | 2-4 hours | 56 hours |
| **TOTAL** | **Full Conversion** | **~56 hours** | **7 weeks** (8h/week) |

**Realistic Timeline:**
- **Aggressive:** 2-3 weeks (20 hours/week)
- **Moderate:** 4-6 weeks (10 hours/week)
- **Relaxed:** 7-8 weeks (8 hours/week)

---

## Critical Files Summary

### Must Convert First
1. `src/db/schema.js` (183 lines)
2. `src/db/client.js` (43 lines)
3. `src/db/__tests__/test-db-helper.js` (163 lines)

### High Priority
4. All repositories (7 files, ~1,000 lines)
5. `src/plugins/donations/server/services/donation.js` (1,306 lines - LARGEST)
6. Utility files (6 files, ~400 lines)

### Medium Priority
7. Plugin controllers
8. API services/controllers
9. Routes and lifecycle hooks

### Lower Priority
10. Test files
11. Example files

---

## Post-Conversion Benefits

### Developer Experience
- ✅ IDE autocomplete for all database queries
- ✅ Type-safe repository methods
- ✅ Catch errors at compile time
- ✅ Refactoring with confidence

### Integration with Frontend
- ✅ Share types between backend and frontend
- ✅ Type-safe API client generation
- ✅ Consistent data models

**Example: Shared Types**
```typescript
// backend/types/api.ts
export interface DonationResponse {
  id: number;
  amount: number;
  donorName: string;
}

// frontend/types/api.ts (symlink or copy)
import type { DonationResponse } from '../../backend/types/api';
```

---

Ready to begin when you approve the plan!
