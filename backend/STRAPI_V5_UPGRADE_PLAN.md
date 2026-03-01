# Strapi v4 → v5 Upgrade Plan

## Executive Summary

Upgrade the annetatargalt backend from Strapi v4.21.1 to Strapi v5, migrating from Entity Service API to Document Service API and transitioning from numeric IDs to UUIDs (`documentId`).

**Key Advantage:** The donation system is already decoupled to Drizzle ORM (completed in Phases 1-6), so only content types (organizations, causes, pages, blog posts) need UUID migration - not thousands of donation records.

---

## Current State Assessment

### ✅ Prerequisites Met

- **Strapi Version**: v4.21.1 (latest v4)
- **Node.js Version**: v20.19.5 (LTS, fully supported by v5)
- **Database**: PostgreSQL (fully supported by v5)
- **Code Structure**: Plugin architecture in place (Phase 6 complete)

### Content Types in Strapi (Will Get UUIDs)

**Core Content** (9 types):
1. `organization` - Charity organizations (~22 entries)
2. `cause` - Cause categories (~3 entries)
3. `blog-post` - Blog articles
4. `blog-author` - Blog authors
5. `page` - Static pages
6. `special-page` - Special pages
7. `global` - Global site config (singleton)
8. `email-config` - Email configuration (singleton)
9. `contact-submission` - Contact form submissions
10. `donation-info` - Payment configuration (singleton)

**Already in Drizzle** (won't be affected):
- Donations, donors, recurring donations, transfers
- All donation-related data stays in separate Drizzle database

### Plugins Used

**Strapi Official Plugins** (will auto-upgrade):
- `@strapi/plugin-i18n` - v4.21.1
- `@strapi/plugin-users-permissions` - v4.21.1
- `@strapi/provider-upload-cloudinary` - v4.21.1

**Third-Party Plugins** (need v5 compatibility check):
- `strapi-plugin-populate-deep` - v3.0.0 (⚠️ check v5 compatibility)
- `strapi-provider-email-brevo` - v1.0.4 (⚠️ check v5 compatibility)

**Custom Plugin**:
- `donations` - Our custom plugin (needs migration)

### Entity Service API Usage

Found **25 files** using Entity Service API that need migration:

**High Priority** (custom business logic):
1. `backend/src/utils/organization-resolver.js` - Organization lookup utility (2 calls)
2. `backend/src/api/organization/services/organization.js` - Org service (2 calls)
3. `backend/src/api/organization/content-types/organization/lifecycles.js` - Deletion protection (2 calls)
4. `backend/src/api/cause/services/cause.js` - Cause service (2 calls)
5. `backend/src/api/contact-submission/controllers/contact-submission.js` - Contact form (1 call)
6. `backend/src/plugins/donations/server/services/donation.js` - Donation service (13 calls)
7. `backend/src/plugins/donations/server/services/organization-donation.js` - Org donation service (2 calls)
8. `backend/src/plugins/donations/server/services/organization-recurring-donation.js` - Org recurring service (1 call)

**Medium Priority** (default controllers/services):
- 9 controllers using `createCoreController` (auto-migrated by codemods)
- 9 services using `createCoreService` (auto-migrated by codemods)

---

## Breaking Changes Impact Assessment

### 1. Numeric IDs → UUIDs (`documentId`)

**Impact**: MEDIUM-LOW (thanks to Drizzle migration!)

**What Changes**:
- Organizations: `id: 1` → `documentId: "aB1cD2eF3gH4iJ5kL6mN7oP8"`
- Causes: Numeric ID → UUID
- Blog posts, pages: Numeric ID → UUID

**What Doesn't Change**:
- ✅ Donations still use numeric IDs in Drizzle
- ✅ Organization linking via `internalId` (string) unaffected
- ✅ No donation data migration needed

**Mitigation**:
- Use `Strapi-Response-Format: v4` header during transition for frontend
- Update frontend to use `documentId` instead of `id`
- Organization resolver already uses `internalId` (not numeric ID)

### 2. Entity Service API → Document Service API

**Impact**: HIGH

**Migration Required In**:
- Organization resolver utility
- Organization/cause services
- Organization lifecycle hooks
- Donation plugin services (organization lookups)
- Contact submission controller

**Change Pattern**:
```javascript
// BEFORE (v4):
await strapi.entityService.findOne("api::organization.organization", id, {
  fields: ["internalId", "title"],
});

// AFTER (v5):
await strapi.documents("api::organization.organization").findOne({
  documentId: id,
  fields: ["internalId", "title"],
});
```

### 3. Response Format Changes

**Impact**: MEDIUM (affects frontend)

**What Changes**:
```json
// v4 Response:
{
  "data": {
    "id": 1,
    "attributes": {
      "title": "AMF"
    }
  }
}

// v5 Response:
{
  "documentId": "aB1cD2eF3...",
  "title": "AMF"
}
```

**Mitigation**: Use `Strapi-Response-Format: v4` header for gradual frontend migration

### 4. Plugin Compatibility

**Impact**: MEDIUM

**Actions Needed**:
- Check `strapi-plugin-populate-deep` v5 compatibility
- Check `strapi-provider-email-brevo` v5 compatibility
- Migrate custom donations plugin to Document Service API
- Update plugin dependencies

---

## Migration Strategy

### Phase 0: Preparation & Backup (Day 1)

**Step 0.1: Full Backup** ⚠️ CRITICAL
```bash
# Backup Strapi database
pg_dump -h localhost -U postgres annetatargalt > backup_strapi_v4_$(date +%Y%m%d_%H%M%S).sql

# Backup Drizzle database (donations)
pg_dump -h localhost -U postgres annetatargalt_donations > backup_drizzle_$(date +%Y%m%d_%H%M%S).sql

# Backup entire codebase
git checkout -b strapi-v5-upgrade
git add -A
git commit -m "Backup before Strapi v5 upgrade"
```

**Step 0.2: Plugin Compatibility Check**
- [ ] Check Marketplace for `strapi-plugin-populate-deep` v5 support
- [ ] Check Marketplace/GitHub for `strapi-provider-email-brevo` v5 support
- [ ] Document migration path or alternatives if incompatible

**Step 0.3: Frontend Assessment**
- [ ] Document all API endpoints used by frontend
- [ ] Identify which responses use numeric IDs
- [ ] Plan frontend migration to `documentId`
- [ ] Prepare `Strapi-Response-Format: v4` header strategy

**Step 0.4: Test Environment Setup**
- [ ] Create fresh database copy for testing
- [ ] Set up Strapi v5 test environment
- [ ] Ensure rollback capability

---

### Phase 1: Automated Upgrade (Day 2)

**Step 1.1: Run Upgrade Tool (Dry Run First)**
```bash
# Dry run to see what will change
npx @strapi/upgrade major --dry

# Review all changes carefully
# Check for __TODO__ comments added by codemods
```

**Step 1.2: Run Actual Upgrade**
```bash
# Run the upgrade
npx @strapi/upgrade major

# This will:
# - Update all Strapi packages to v5
# - Run codemods to transform code
# - Add __TODO__ comments where manual work needed
# - Update package.json dependencies
```

**Step 1.3: Install Updated Dependencies**
```bash
yarn install
```

**Step 1.4: Review Codemod Changes**
```bash
# Search for TODO comments added by codemods
git diff
grep -r "__TODO__" backend/src
```

**Expected Codemod Changes**:
- `createCoreController` → Updated for v5
- `createCoreService` → Updated for v5
- Some `entityService` calls → `strapi.documents()` (with `__TODO__` for IDs)
- Import statements updated
- Config file format changes

---

### Phase 2: Manual Migration (Day 3-4)

**Step 2.1: Migrate Organization Resolver**

File: `backend/src/utils/organization-resolver.js`

Current usage:
```javascript
// Line 32 & 68
const organizations = await this.strapi.entityService.findMany(
  "api::organization.organization",
  {
    filters: { internalId: { $in: internalIds } },
    fields: ["internalId", "title", "slug", "logo"],
  }
);
```

Migrate to:
```javascript
const organizations = await this.strapi.documents("api::organization.organization").findMany({
  filters: { internalId: { $in: internalIds } },
  fields: ["internalId", "title", "slug", "logo"],
});
```

**Step 2.2: Migrate Organization Service**

File: `backend/src/api/organization/services/organization.js`

Migrate:
- `findMany` (line 13)
- `create` (line 32)

**Step 2.3: Migrate Cause Service**

File: `backend/src/api/cause/services/cause.js`

Migrate:
- `findMany` (line 11)
- `create` (line 30)

**Step 2.4: Migrate Organization Lifecycles**

File: `backend/src/api/organization/content-types/organization/lifecycles.js`

Critical for deletion protection:
```javascript
// BEFORE:
const organization = await strapi.entityService.findOne(
  "api::organization.organization",
  event.params.where.id,
  { fields: ["internalId"] }
);

// AFTER:
const organization = await strapi.documents("api::organization.organization").findOne({
  documentId: event.params.where.documentId, // Changed from id
  fields: ["internalId"],
});
```

**Note**: `event.params.where.id` → `event.params.where.documentId` in v5

**Step 2.5: Migrate Donation Plugin Services**

Files:
- `backend/src/plugins/donations/server/services/donation.js` (13 calls)
- `backend/src/plugins/donations/server/services/organization-donation.js` (2 calls)
- `backend/src/plugins/donations/server/services/organization-recurring-donation.js` (1 call)

All calls are organization lookups like:
```javascript
// BEFORE:
const organization = await strapi.entityService.findOne(
  "api::organization.organization",
  orgId,
  { fields: ["internalId"] }
);

// AFTER:
const organization = await strapi.documents("api::organization.organization").findOne({
  documentId: orgId,
  fields: ["internalId"],
});
```

**Challenge**: These services receive organization IDs from frontend/database. Need to determine:
- Are these numeric IDs or already `documentId`?
- May need migration mapping table temporarily

**Step 2.6: Migrate Contact Submission Controller**

File: `backend/src/api/contact-submission/controllers/contact-submission.js`

Migrate `entityService.create` to Document Service.

**Step 2.7: Address All `__TODO__` Comments**

Search codebase for remaining TODOs:
```bash
grep -r "__TODO__" backend/src
```

Resolve each one manually.

---

### Phase 3: Database Migration (Day 5)

**Step 3.1: Run Strapi v5 First Startup**

When Strapi v5 starts for the first time, it automatically:
- Migrates database schema
- Generates UUIDs for all existing content
- Creates `documentId` column
- Preserves old numeric `id` column for compatibility

```bash
# Start Strapi v5
yarn develop

# Watch logs carefully for migration errors
```

**Step 3.2: Verify Data Migration**

Check database after migration:
```sql
-- Verify organizations have documentId
SELECT id, document_id, internal_id, title FROM organizations LIMIT 10;

-- Verify causes have documentId
SELECT id, document_id, title FROM causes LIMIT 10;

-- Verify blog posts
SELECT id, document_id, title FROM blog_posts LIMIT 10;
```

**Step 3.3: Test API Responses**

```bash
# Test v5 format (new default)
curl http://localhost:1337/api/organizations

# Test v4 compatibility mode
curl -H "Strapi-Response-Format: v4" http://localhost:1337/api/organizations

# Both should work
```

---

### Phase 4: Testing & Validation (Day 6-7)

**Step 4.1: Run Existing Tests**

```bash
# Run all unit tests
yarn test:unit

# Run integration tests
yarn test:integration

# All 44 unit + 47 integration tests should pass
```

**Step 4.2: Manual Testing Checklist**

**Content Management**:
- [ ] Create new organization
- [ ] Update existing organization
- [ ] Delete organization (should still be blocked if has donations)
- [ ] Create new blog post
- [ ] Update existing blog post
- [ ] Create new cause

**Donation Flow** (should be unaffected):
- [ ] Create test donation
- [ ] Complete payment flow
- [ ] Verify webhook processing
- [ ] Check confirmation email
- [ ] Verify stats dashboard

**Admin Panel**:
- [ ] Login to admin
- [ ] Browse organizations
- [ ] Edit content
- [ ] Upload images
- [ ] Check media library

**API Endpoints**:
- [ ] `/api/organizations` - List organizations
- [ ] `/api/causes` - List causes
- [ ] `/api/blog-posts` - List blog posts
- [ ] `/api/stats` - Donation stats
- [ ] `/api/donate` - Create donation

**Step 4.3: Frontend Integration Testing**

Test with actual frontend:
- [ ] Homepage loads correctly
- [ ] Organization pages render
- [ ] Donation flow works
- [ ] Blog posts display
- [ ] Images load correctly

**Step 4.4: Performance Testing**

Compare v4 vs v5 performance:
- [ ] API response times
- [ ] Database query performance
- [ ] Admin panel load times
- [ ] Build times

---

### Phase 5: Plugin Migration (Day 8)

**Step 5.1: Update Donations Plugin**

The donations plugin needs updates:

1. **Update service method calls**:
   - Change all `entityService` to `strapi.documents()`
   - Update organization lookups to use `documentId`

2. **Update plugin dependencies** (if needed):
   - Check if plugin SDK needs to be used
   - Update Strapi factory imports

3. **Test plugin independently**:
   - Verify all 14 donation endpoints work
   - Test with actual payment flow

**Step 5.2: Handle Third-Party Plugins**

**If `strapi-plugin-populate-deep` incompatible**:
- Option 1: Remove and refactor code to manually populate relations
- Option 2: Wait for v5 update or find alternative
- Option 3: Fork and update yourself

**If `strapi-provider-email-brevo` incompatible**:
- Option 1: Update to v5-compatible email provider
- Option 2: Fork and update yourself
- Option 3: Switch to different email service

---

### Phase 6: Frontend Migration (Day 9-10)

**Step 6.1: Update API Client**

Add header to all Strapi API calls:
```javascript
// Temporary compatibility during migration
fetch('/api/organizations', {
  headers: {
    'Strapi-Response-Format': 'v4'
  }
})
```

**Step 6.2: Gradual Migration to `documentId`**

1. Update one component at a time
2. Change from `id` to `documentId`
3. Test thoroughly
4. Repeat for all components

**Step 6.3: Remove v4 Compatibility Header**

Once all frontend code uses `documentId`:
- Remove `Strapi-Response-Format: v4` header
- Use native v5 response format
- Enjoy flatter response structure

---

### Phase 7: Production Deployment (Day 11)

**Step 7.1: Pre-Deployment Checklist**

- [ ] All tests passing (91 total tests)
- [ ] Frontend works with v5 backend
- [ ] Database backup created
- [ ] Rollback plan documented
- [ ] Downtime window communicated

**Step 7.2: Deployment Steps**

```bash
# 1. Backup production database
pg_dump -h production-host -U postgres annetatargalt > production_backup_v4.sql

# 2. Stop Strapi
pm2 stop strapi

# 3. Deploy code
git push production strapi-v5-upgrade

# 4. Install dependencies
yarn install --production

# 5. Build admin panel
yarn build

# 6. Start Strapi (triggers migration)
pm2 start strapi

# 7. Monitor logs
pm2 logs strapi
```

**Step 7.3: Production Monitoring (First 24 Hours)**

- [ ] Check error logs every hour
- [ ] Monitor API response times
- [ ] Verify donation flow working
- [ ] Check email delivery
- [ ] Verify webhook processing
- [ ] Monitor database performance

**Step 7.4: Frontend Deployment**

Deploy frontend with:
- Option 1: `Strapi-Response-Format: v4` header (safe, gradual)
- Option 2: Full `documentId` migration (requires thorough testing)

---

## Rollback Plan

**If Critical Issues Occur**:

**Within First Hour**:
1. Stop Strapi v5
2. Restore code to v4 branch
3. Restart Strapi v4
4. No data loss (v4 schema still compatible)

**Within First Day**:
1. Stop Strapi v5
2. Restore database from backup
3. Restore code to v4
4. Restart Strapi v4
5. May lose new content created in v5

**After Several Days**:
1. Export new content from v5
2. Restore database from v4 backup
3. Manually re-enter new content
4. More complex, avoid if possible

---

## Risk Assessment

### Critical Risks

**Risk 1: Database Migration Failure**
- **Impact**: Complete system outage
- **Probability**: Low (Strapi's migration is well-tested)
- **Mitigation**: Full database backup, test on staging first

**Risk 2: Plugin Incompatibility**
- **Impact**: Loss of functionality (deep population, email)
- **Probability**: Medium
- **Mitigation**: Check compatibility before upgrade, have alternatives ready

**Risk 3: Frontend Breaking Changes**
- **Impact**: User-facing site broken
- **Probability**: Medium (ID changes affect frontend)
- **Mitigation**: Use v4 compatibility header during transition

**Risk 4: Donation Flow Breakage**
- **Impact**: Lost revenue, angry donors
- **Probability**: Low (donations in Drizzle, isolated)
- **Mitigation**: Thorough testing, monitor closely after deployment

### Medium Risks

**Risk 5: Performance Degradation**
- **Impact**: Slower API responses
- **Probability**: Low (v5 generally faster)
- **Mitigation**: Performance testing before production

**Risk 6: Third-Party Integration Issues**
- **Impact**: Broken integrations (Cloudinary, Brevo, Montonio)
- **Probability**: Low-Medium
- **Mitigation**: Test all integrations in staging

---

## Success Criteria

Migration is successful when:

1. **All Tests Passing**:
   - [ ] 44 unit tests passing
   - [ ] 47 integration tests passing
   - [ ] No new test failures

2. **Core Functionality Working**:
   - [ ] Admin panel accessible and functional
   - [ ] All content types CRUD operations work
   - [ ] Donation flow works end-to-end
   - [ ] Email delivery functional
   - [ ] Payment webhooks processing

3. **API Compatibility**:
   - [ ] All API endpoints responding correctly
   - [ ] Frontend works with backend
   - [ ] No breaking changes for external consumers

4. **Data Integrity**:
   - [ ] All content migrated to UUIDs
   - [ ] No data loss
   - [ ] All relations preserved
   - [ ] Donations still linked to organizations via `internalId`

5. **Performance**:
   - [ ] API response times equal or better
   - [ ] Database queries optimized
   - [ ] Admin panel responsive

6. **Production Stability** (7 days):
   - [ ] No critical errors in logs
   - [ ] Payment success rate unchanged
   - [ ] Email delivery rate normal
   - [ ] No user complaints

---

## Timeline Estimate

- **Phase 0** (Preparation): 1 day
- **Phase 1** (Automated Upgrade): 1 day
- **Phase 2** (Manual Migration): 2 days
- **Phase 3** (Database Migration): 1 day
- **Phase 4** (Testing): 2 days
- **Phase 5** (Plugin Migration): 1 day
- **Phase 6** (Frontend Migration): 2 days
- **Phase 7** (Production Deployment): 1 day

**Total: ~11 days of focused work**

---

## Key Advantages of Our Position

✅ **Donations Already Decoupled**: The biggest win - thousands of donation records don't need UUID migration

✅ **Plugin Architecture in Place**: Proper DI pattern already implemented (Phase 6)

✅ **Comprehensive Tests**: 91 tests provide safety net for regression detection

✅ **Latest v4**: Already on v4.21.1 (no minor upgrade needed)

✅ **Modern Node.js**: v20 LTS fully supported by v5

✅ **Small Content Dataset**: Only ~22 organizations, ~3 causes - UUID migration is trivial

✅ **Clean Codebase**: Recent refactoring makes migration easier

---

## Next Steps

1. **Check plugin compatibility** (critical blocker)
2. **Create staging environment** for safe testing
3. **Run dry upgrade** to see what changes
4. **Begin Phase 0 preparation** when ready

Ready to proceed?
