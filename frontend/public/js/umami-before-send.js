// Umami's data-before-send hook (RootHtml.tsx), loaded just before its tracker. Addresses go to Umami
// without their query string, which can hold what a visitor typed or a payment's order token (the
// thank-you page, the income calculator), except the campaign tags Umami reads from it (utm_*, ref),
// and without their fragment, which holds a donor's token on the page for choosing emails.
// Referrers from other sites keep only their origin and path.
window.umamiBeforeSend = function (type, payload) {
  try {
    if (payload.url) {
      var url = new URL(payload.url, location.href);
      var kept = new URLSearchParams();
      url.searchParams.forEach(function (value, key) {
        if (key.indexOf("utm_") === 0 || key === "ref") kept.append(key, value);
      });
      url.search = kept.toString();
      url.hash = "";
      payload.url = url.toString();
    }
    if (payload.referrer && /^https?:/.test(payload.referrer)) {
      var referrer = new URL(payload.referrer);
      payload.referrer = referrer.origin + referrer.pathname;
    } else if (payload.referrer) {
      payload.referrer = payload.referrer.split(/[?#]/)[0];
    }
  } catch (e) {
    return null;
  }
  return payload;
};
