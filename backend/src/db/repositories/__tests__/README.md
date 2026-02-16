# Repository Integration Tests

These tests interact with a real PostgreSQL database to verify Drizzle repository operations.

## Prerequisites

1. **Database Setup**: Requires a Drizzle database configured with environment variables
2. **Database Schema**: Schema must be applied (`npx drizzle-kit push`)
3. **Database Credentials**: Valid credentials in `.env` file

## Environment Variables

Test configuration is stored in `.env.test` (not committed to git):

1. **Copy the example file:**
   ```bash
   cp .env.test.example .env.test
   ```

2. **Edit `.env.test` with your local credentials:**
   ```bash
   DATABASE_HOST=127.0.0.1
   DATABASE_PORT=5432
   DATABASE_USERNAME=your_postgres_username
   DATABASE_PASSWORD=your_postgres_password
   DRIZZLE_DATABASE_NAME=annetatargalt_donations_test
   INTEGRATION_TESTS=true
   ```

**Note:** The `.env.test` file is automatically loaded when running `yarn test:integration`.

## Running Repository Tests

**Run unit tests only (default):**
```bash
yarn test
# or
yarn test:unit
```

**Run repository integration tests:**
```bash
yarn test:integration
```

**Run all tests (unit + integration):**
```bash
yarn test:all
```

**Advanced: Manual environment variables (if needed):**
```bash
DATABASE_USERNAME=your_username DRIZZLE_DATABASE_NAME=annetatargalt_donations_test INTEGRATION_TESTS=true yarn test repositories
```

## What These Tests Cover

- **DonationsRepository** - CRUD, queries, stats aggregations
- **OrganizationDonationsRepository** - Junction table operations, splits
- **DonorsRepository** - Donor lookups, email/ID code queries

## Important Notes

⚠️ **These tests will clean the database** before each test run using `cleanDatabase()`.

**DO NOT run against production database!**

Use a separate test database (e.g., `annetatargalt_donations_test`).

## Test Database Setup

1. Create test database:
```bash
createdb annetatargalt_donations_test
```

2. Apply schema:
```bash
dotenv -e .env.test -- npx drizzle-kit push
```

3. Run tests:
```bash
yarn test:integration
```
