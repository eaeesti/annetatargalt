/**
 * Anneta Targalt's branding in the admin: the logo on the login page and in
 * the menu, the site's green instead of Strapi's purple, and welcome texts
 * that say where editors are. The browser tab's icon is ../../favicon.png,
 * which Strapi serves as /favicon.ico. Also the login page's Google button.
 */
import type { StrapiApp } from "@strapi/strapi/admin";
import icon from "./extensions/icon.png";
import { showGoogleLogin } from "./google-login";
import logo from "./extensions/logo.png";

/**
 * The site's palette (frontend/src/app/globals.css), in Strapi's names, one
 * shade darker than the names say where white text or text on white needs
 * the contrast. Buttons are primary-700 and turn primary-600 on hover, as on
 * the site.
 */
const lightColors = {
  primary100: "#eef8f2",
  primary200: "#d4ede1",
  primary500: "#099067",
  primary600: "#047857",
  primary700: "#065f46",
  buttonPrimary500: "#099067",
  buttonPrimary600: "#047857",
};

/** Lighter greens for text and outlines on the dark background. */
const darkColors = {
  primary200: "#064e3b",
  primary500: "#099067",
  primary600: "#50c79c",
  primary700: "#81ceb0",
  buttonPrimary500: "#099067",
  buttonPrimary600: "#047857",
};

export default {
  config: {
    auth: { logo },
    menu: { logo: icon },
    theme: {
      light: { colors: lightColors },
      dark: { colors: darkColors },
    },
    translations: {
      en: {
        "Auth.form.welcome.title": "Anneta Targalt's website",
        "Auth.form.welcome.subtitle": "Log in to edit annetatargalt.ee",
        "app.components.LeftMenu.navbrand.title": "Anneta Targalt",
        "app.components.LeftMenu.navbrand.workplace": "Website",
      },
    },
    // Strapi's video tutorials and release news are for developers.
    tutorials: false,
    notifications: { releases: false },
  },
  bootstrap(_app: StrapiApp) {
    void showGoogleLogin();
  },
};
