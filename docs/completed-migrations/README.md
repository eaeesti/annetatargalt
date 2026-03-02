# Completed Migrations Archive

This directory contains documentation and scripts from completed migration projects.

## Projects Archived

### 1. Drizzle ORM Migration (2026-02)
**Status**: ✅ Complete
**Documentation**: [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
**Test Status**: [TEST_STATUS.md](./TEST_STATUS.md)

Migrated donation system from Strapi content-types to Drizzle ORM with Postgres. This separated transactional data (donations) from content data (organizations, causes).

**Key achievements:**
- 109 tests (44 unit + 47 integration + 18 e2e)
- Zero-downtime migration
- Type-safe data layer
- Improved performance for stats queries

### 2. Organization ID Migration (2026-03-01)
**Status**: ✅ Complete
**Documentation**: [ORGANIZATION_ID_MIGRATION.md](./ORGANIZATION_ID_MIGRATION.md)

Migrated from numeric organization IDs to semantic `internalId` strings (e.g., "AMF", "GD"). Critical prerequisite for Strapi v5 upgrade.

**Key achievements:**
- Backward-compatible URLs (`?org=14` still works)
- 50% reduction in database queries
- Cleaner, semantic URLs (`?org=AMF`)
- Ready for Strapi v5 UUID migration

### 3. Strapi v5 Upgrade (2026-03-01)
**Status**: ✅ Complete
**Documentation**: [STRAPI_V5_UPGRADE_STATUS.md](./STRAPI_V5_UPGRADE_STATUS.md)
**Original Plan**: [STRAPI_V5_UPGRADE_PLAN.md](./STRAPI_V5_UPGRADE_PLAN.md)

Upgraded from Strapi v4.21.1 to v5.37.1. Migrated from Entity Service API to Document Service API.

**Key achievements:**
- All 91 tests passing
- Zero breaking changes for frontend
- Only ~25 content records migrated (not 1000+ donations)
- Build time 20 minutes in production (memory-constrained server)

## Migration Scripts

One-time migration scripts preserved for historical reference in [`scripts/`](./scripts/).

**Scripts:**
- `00-populate-organization-internal-ids-db.js` - Populate junction tables with internalIds
- `01-export-strapi-data.js` - Export donations from Strapi via API
- `01-export-strapi-data-direct.js` - Direct database export (alternative method)
- `02-migrate-to-drizzle.js` - Transform and import to Drizzle
- `03-populate-global-internal-ids.js` - Populate global config internalIds
- `populate-global-internal-ids.js` - Standalone script for Phase 3

## Timeline

- **Phase 0-6** (Drizzle Migration): Feb 14-28, 2026 (~2 weeks)
- **Organization ID Migration**: March 1, 2026 (1 day)
- **Strapi v5 Upgrade**: March 1, 2026 (1 day, after prerequisites)

## Lessons Learned

1. **Test first, migrate later** - Phase 0 test infrastructure caught critical bugs
2. **Decouple data types** - Separating transactional from content data simplified v5 upgrade
3. **Semantic IDs > Numeric IDs** - InternalIds are more stable across environments
4. **Memory matters** - Production builds require 2GB heap on 960MB RAM server (swap usage)
5. **TODOs are dangerous** - Auth TODOs left admin endpoints exposed for months

## Next Steps

With migrations complete, focus shifts to:
1. Next.js upgrade to latest version
2. TypeScript conversion (backend + frontend)
3. E2E test implementation
