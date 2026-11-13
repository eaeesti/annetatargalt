/**
 * The "Log in with Google" button on the admin's login page, in place of the
 * password form, when the server has Google login on
 * (src/middlewares/google-login.ts). Passwords are refused then anyway.
 *
 * Strapi has no place for extra login buttons outside its Enterprise SSO,
 * so this changes the page's DOM. If a Strapi update moves the form, the
 * button may not appear, but /google-login still works on its own.
 */

const BLOCK_ID = "google-login";

function errorMessage(code: string | null, domain: string): string | null {
  switch (code) {
    case "cancelled":
      return "Logging in with Google was cancelled.";
    case "failed":
      return "Logging in with Google didn't work. Please try again.";
    case "wrong-account":
      return `Log in with your @${domain} Google account.`;
    case "no-account":
      return "Your account has no access yet. Ask an administrator to add your address under Settings → Users.";
    default:
      return null;
  }
}

/** Google's "G", as its sign-in button guidelines show it. */
const GOOGLE_G = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text) node.textContent = text;
  return node;
}

function googleBlock(domain: string): HTMLElement {
  const block = element("div", {});
  block.id = BLOCK_ID;

  const error = errorMessage(
    new URLSearchParams(location.search).get(BLOCK_ID),
    domain,
  );
  if (error) {
    const alert = element(
      "p",
      {
        borderLeft: "4px solid #d02b20",
        padding: "8px 12px",
        marginBottom: "16px",
        fontSize: "14px",
        lineHeight: "1.4",
      },
      error,
    );
    alert.setAttribute("role", "alert");
    block.append(alert);
  }

  // White with a grey border, as Google's guidelines have it, in both themes.
  const button = element("a", {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    height: "40px",
    borderRadius: "4px",
    border: "1px solid #dcdce4",
    background: "#ffffff",
    color: "#32324d",
    fontSize: "14px",
    fontWeight: "600",
    textDecoration: "none",
  });
  button.href = "/google-login";
  button.innerHTML = GOOGLE_G;
  button.append("Log in with Google");
  block.append(button);

  return block;
}

function addButton(domain: string): void {
  if (!location.pathname.endsWith("/auth/login")) return;
  if (document.getElementById(BLOCK_ID)) return;
  const form = document.querySelector("form");
  if (!form) return;
  form.before(googleBlock(domain));
  // Passwords are refused, so their form and reset link would only mislead.
  form.style.display = "none";
  const reset = document.querySelector<HTMLElement>(
    'a[href$="/auth/forgot-password"]',
  );
  if (reset) reset.style.display = "none";
}

export async function showGoogleLogin(): Promise<void> {
  let domain: string | null = null;
  try {
    const response = await fetch("/google-login/enabled");
    const body: unknown = response.ok ? await response.json() : null;
    if (
      typeof body === "object" &&
      body !== null &&
      "enabled" in body &&
      body.enabled === true &&
      "domain" in body &&
      typeof body.domain === "string"
    ) {
      domain = body.domain;
    }
  } catch {
    return;
  }
  if (!domain) return;
  const workspace = domain;
  // The admin renders its pages itself, so watch for the login page.
  new MutationObserver(() => addButton(workspace)).observe(document.body, {
    childList: true,
    subtree: true,
  });
  addButton(workspace);
}
