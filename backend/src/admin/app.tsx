/**
 * Strapi's admin, as it comes, plus the login page's Google button.
 */
import type { StrapiApp } from "@strapi/strapi/admin";
import { showGoogleLogin } from "./google-login";

export default {
  config: {},
  bootstrap(_app: StrapiApp) {
    void showGoogleLogin();
  },
};
