# Donations Plugin

A custom Strapi plugin that manages all donation-related functionality using Drizzle ORM.

## Overview

This plugin handles:
- **Donation processing** - Creating and managing donations via Drizzle ORM
- **Donor management** - Tracking donor information
- **Organization donations** - Splitting donations across multiple organizations
- **Recurring donations** - Managing subscription-based donations
- **Donation transfers** - Batch transfer tracking

## Architecture

**Data Layer:**
- All donation data stored in separate Drizzle database (PostgreSQL)
- Organizations/causes remain in Strapi CMS
- Cross-system linking via `organization.internalId`

**API Structure (Hybrid Approach):**
- **Plugin**: Controllers and services with proper dependency injection at `src/plugins/donations/`
- **Proxy Controllers**: Thin wrappers at `src/api/donation/controllers/` that delegate to plugin
- **Routes**: Defined in `src/api/donation/routes/custom-donation-routes.js` for `/api/*` backward compatibility
- **Services**: Plugin services accessible via `strapi.plugin('donations').service('name')`

This hybrid approach maintains backward-compatible URLs (`/api/*`) while using proper plugin architecture for code organization. The proxy pattern is necessary because Strapi 4 plugins automatically get `/api/{pluginName}/` prefixes, which would break existing frontend integration.

## API Endpoints

All endpoints use the `/api/` prefix (backward compatible with existing frontend):

### Public Endpoints
- `POST /api/donate` - Create new donation
- `POST /api/donateExternal` - External donation flow
- `POST /api/donateForeign` - Foreign donations
- `POST /api/confirm` - Payment confirmation webhook (Montonio)
- `GET /api/decode` - Retrieve donation details by order token
- `GET /api/stats` - Public donation statistics

### Admin Endpoints (TODO: Add auth)
- `POST /api/import` - Import donation data
- `GET /api/export` - Export all donation data
- `POST /api/deleteAll` - Delete all donations (requires confirmation)
- `GET /api/findTransaction` - Find donation by transaction details
- `POST /api/insertTransaction` - Insert donation from bank transaction
- `POST /api/insertDonation` - Manually create donation
- `POST /api/migrateTips` - Migrate tips to donations
- `PUT /api/addDonationsToTransferByDate` - Add donations to transfer batch

## Usage

### Calling Services from Code

```js
// Get donation service
const donationService = strapi.plugin('donations').service('donation');

// Create donation
const result = await donationService.createDonation(donationData);

// Get donor service
const donorService = strapi.plugin('donations').service('donor');

// Find or create donor
const donor = await donorService.findOrCreateDonor(donorData);
```

### Available Services

- `donation` - Main donation business logic
- `donor` - Donor management
- `organization-donation` - Organization donation splits
- `organization-recurring-donation` - Recurring donation splits

## Migration from API Structure

This plugin was migrated from the old `src/api/donation/` structure to provide:

1. **Proper dependency injection** - No more `global.strapi` anti-pattern
2. **Clean architecture** - Separation from content-type APIs
3. **Strapi v5 compatibility** - Plugin structure is future-proof
4. **Better testing** - Can be tested in isolation
5. **Reusability** - Can be extracted to npm package

### Key Changes

**Before** (API structure):
```js
// Controller in src/api/donation/controllers/donation.js
module.exports = {
  async donate(ctx) {
    const strapi = global.strapi; // ❌ Anti-pattern
    await strapi.service('api::donation.donation').method();
  }
};
```

**After** (Plugin structure with proxy pattern):
```js
// Plugin controller in src/plugins/donations/server/controllers/donation.js
module.exports = ({ strapi }) => ({
  async donate(ctx) {
    // ✅ Strapi injected properly
    await strapi.plugin('donations').service('donation').method();
  }
});

// Proxy controller in src/api/donation/controllers/donation.js
module.exports = {
  async donate(ctx) {
    // ✅ Delegates to plugin controller
    return strapi.plugin('donations').controller('donation').donate(ctx);
  }
};

// Routes in src/api/donation/routes/custom-donation-routes.js
module.exports = {
  routes: [
    {
      method: "POST",
      path: "/donate",
      handler: "donation.donate", // ✅ Points to proxy controller
      config: { policies: [], auth: false },
    },
  ],
};
```

## Testing

### 1. Verify Plugin Loads

Start Strapi and check logs for:
```
[INFO] Plugin: donations (loaded)
```

### 2. Test Service Access

In Strapi console or create test endpoint:
```js
const donationService = strapi.plugin('donations').service('donation');
console.log('Service loaded:', !!donationService);
console.log('Methods:', Object.keys(donationService));
```

### 3. Test Endpoints

```bash
# Test stats endpoint (same URL as before!)
curl http://localhost:1337/api/stats

# Test donation creation (requires full data)
curl -X POST http://localhost:1337/api/donate \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User",...}'
```

### 4. Verify Bootstrap Validation

The bootstrap validation in `src/index.js` should still work:
- Fresh installs allowed
- Migrated installs verify Drizzle connection
- Unmigrated installs blocked with error

## Dependencies

- **Drizzle ORM** - Database layer for donations
- **PostgreSQL** - Donation database (separate from Strapi)
- **Montonio** - Payment gateway integration
- **Brevo** - Email service for confirmations

## Environment Variables

Required for donation functionality:
```env
DRIZZLE_DATABASE_NAME=your_donations_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
```

## Future Improvements

- [ ] Add authentication to admin endpoints
- [ ] Add rate limiting to public endpoints
- [ ] Extract to standalone npm package
- [ ] Add comprehensive API documentation
- [ ] Add plugin configuration options
- [ ] Improve error handling and logging

## Strapi v5 Compatibility

This plugin structure is designed to be forward-compatible with Strapi v5:
- Uses proper dependency injection
- No reliance on global state
- Clean API boundaries
- Standard plugin structure

When upgrading to Strapi v5:
1. Update plugin structure if needed (ESM, etc.)
2. Test all endpoints
3. Verify Drizzle compatibility
4. No UUID migration needed (data in separate DB)
