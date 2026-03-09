# Admin Panel

A separate Next.js app for managing donations data.

## Tech Stack

- **Framework**: Next.js (App Router), TypeScript strict
- **UI**: shadcn/ui (Tailwind-based, great data tables and forms)
- **Auth**: Strapi admin credentials reused via `POST /admin/login`

## Auth

Strapi exposes `POST /admin/login` → returns a JWT.  
The donation admin endpoints already use `admin::isAuthenticatedAdmin`, which validates exactly this JWT.
No separate user database needed — user management stays in Strapi admin.

```
1. User submits email + password on /login page
2. Next.js API route proxies to Strapi POST /admin/login
3. Strapi returns JWT
4. Next.js stores JWT in httpOnly cookie
5. middleware.ts redirects unauthenticated requests to /login
6. All Strapi calls include Authorization: Bearer <token>
```

## Structure

```
annetatargalt/
├── admin/          ← Next.js app (port 3001)
├── frontend/       ← Public site (port 3000)
└── backend/        ← Strapi (port 1337)
```

## Available Admin Endpoints (no backend changes needed)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/stats | Donation totals (public) |
| GET | /api/export | Export all data as JSON |
| POST | /api/import | Bulk import from JSON |
| POST | /api/deleteAll | Purge all data |
| GET | /api/findTransaction | Find by bank transaction |
| POST | /api/insertTransaction | Insert from bank statement |
| POST | /api/insertDonation | Manually insert donation |
| PUT | /api/addDonationsToTransferByDate | Link donations to transfer |

## Implementation Order

1. Scaffold with `create-next-app`
2. Install shadcn/ui
3. Auth: login page, API route, cookie helpers, middleware guard
4. Dashboard stub with stats
5. Add features incrementally from the endpoint list above

## Phase 1 Scope (initial implementation)

### Backend additions
New route `GET /api/donations/list` (admin-protected) backed by `DonationsRepository.findAll()`.
See `backend/src/api/donation/routes/custom-donation-routes.ts` and `backend/src/plugins/donations/server/controllers/donation.ts`.

### Frontend
Scaffolded Next.js app at `admin/` with:
- Login page + Strapi JWT auth via httpOnly cookie
- `middleware.ts` auth guard
- Basic donations list table as proof of auth working end-to-end
