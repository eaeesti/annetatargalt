/**
 * Strapi admin roles allowed to bridge into the DonationAdmin users-permissions
 * role (see api/admin-auth/controllers/admin-auth.ts) and stay bridged (see
 * index.ts's blockOrphanedDonationAdmins). Shared so the "who gets in" and
 * "who gets kept" checks can never drift apart.
 *
 * Matched by role `code`, not `name`: a role's display name can be renamed at
 * any time via Strapi's Settings UI with no warning, which would silently
 * break a name-based check — locking out (or, the other direction, wrongly
 * admitting) an admin with nobody noticing until it's investigated. `code` is
 * set once when a role is created and there's no way to change it afterward
 * through Strapi's role-update endpoint.
 *
 * "strapi-super-admin" is Strapi's own reserved code for the built-in Super
 * Admin role — the same on every installation. The rest are this specific
 * installation's custom roles; a role's code is visible in Strapi under
 * Settings → Administration Panel → Roles, or via `select code from
 * admin_roles`. A fresh installation reusing this codebase needs its own
 * custom role's code here, not this one.
 */
export const BRIDGEABLE_ADMIN_ROLE_CODES = new Set([
  "strapi-super-admin",
  "admin-lt8jhmbu", // this installation's custom "Admin" role
]);
