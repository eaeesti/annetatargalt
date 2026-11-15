# Donations Plugin

Takes donations from the site: one-off and recurring, split between
organizations, paid through Montonio or by bank transfer, with the
confirmation emails. The donations, donors and recurring donations are kept in
their own database with Drizzle ORM (`src/db/`), apart from Strapi's content.
Organizations stay in Strapi, and donations refer to them by their
`internalId`.

The admin panel's endpoints are in the other plugin, `../admin-panel/`.

## Layout

- `server/controllers/donation.ts`: the HTTP handlers
- `server/services/`: `donation` (most of the logic), `donor`,
  `organization-donation` and `organization-recurring-donation`
- The routes are in `src/api/donation/routes/custom-donation-routes.ts`, with
  a controller there that hands each request to this plugin's. A plugin's own
  routes would be under `/api/donations/`, and these keep the site's URLs
  under `/api/`.

Code elsewhere reaches it through Strapi:

```ts
strapi.plugin("donations").service("donation").createDonation(donation);
```

## Endpoints

Public:

- `POST /api/donate`: a donation from the site
- `POST /api/donateExternal`: a donation from a partner's site
- `POST /api/donateForeign`: a donation from abroad, by someone without an Estonian ID code
- `POST /api/confirm`: Montonio's notice that a payment went through
- `GET /api/decode`: a donation's details from its order token, for the
  thank-you page
- `GET /api/stats`: totals for the site

For users-permissions roles that are allowed them (the admin panel's
DonationAdmin): `GET /api/export` and `GET /api/findTransaction`.

## Changes take a build

Strapi loads this plugin from the built code (`config/plugins.js` points at
`./dist/src/plugins/donations`), so a change here, or to anything it imports,
takes effect only after `pnpm build` and a restart. Pointing the config at
`src/` instead makes Strapi skip the plugin without an error.
