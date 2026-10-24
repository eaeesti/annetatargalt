/*
 * The session cookie. In production its name starts with __Host-: browsers
 * then accept it only from this exact host over HTTPS, so another
 * annetatargalt.ee site can't set one for the admin panel. Development runs
 * on plain HTTP, which the prefix doesn't allow, so it keeps the plain name.
 */
export const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-admin-session"
    : "strapi-admin-token";
export const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours in seconds
