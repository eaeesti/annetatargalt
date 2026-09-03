/**
 * Diagnose the Montonio payouts API used by the statement-import card-payout
 * resolution. Read-only. Run on the VPS with the production env:
 *
 *   yarn montonio-payouts-check
 *
 * Prints the raw HTTP status + body for the payouts list and one payout's
 * order export, so a wrong base path / store UUID / auth is obvious.
 */
import montonio from "../utils/montonio";

const base = process.env.MONTONIO_URL;
const storeUuid = process.env.MONTONIO_STORE_UUID;

async function hit(url: string) {
  const token = montonio.createAuthToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* leave as text */
  }
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  console.log("MONTONIO_URL         :", base ?? "(unset)");
  console.log("MONTONIO_STORE_UUID  :", storeUuid ?? "(unset)");
  console.log(
    "MONTONIO_PUBLIC set  :",
    Boolean(process.env.MONTONIO_PUBLIC),
    "  PRIVATE set:",
    Boolean(process.env.MONTONIO_PRIVATE),
  );
  if (!base || !storeUuid || !process.env.MONTONIO_PRIVATE) {
    console.log(
      "\nMissing config — set MONTONIO_STORE_UUID (and check the rest).",
    );
    return;
  }

  const listUrl = `${base}/stores/${storeUuid}/payouts?limit=10&offset=0&order=DESC`;
  console.log(`\nGET ${listUrl}`);
  const list = await hit(listUrl);
  console.log("  status:", list.status, list.ok ? "OK" : "FAIL");
  console.log("  body  :", JSON.stringify(list.body, null, 2).slice(0, 1500));

  if (!list.ok) {
    const msg = JSON.stringify(list.body);
    if (list.status === 404 && /uuid|resource|store/i.test(msg)) {
      console.log(
        "\n404 but the endpoint resolved and looked up the UUID — the path is right, this store UUID just doesn't exist for these keys / this environment. Check you copied the UUID from the same (live) account as MONTONIO_PUBLIC/PRIVATE.",
      );
    } else if (list.status === 404) {
      console.log(
        "\n404 route not found — the base path is wrong. Try MONTONIO_URL without /api, or with /v2.",
      );
    } else if (list.status === 401 || list.status === 403) {
      console.log(
        "\nAuth rejected — the key pair isn't authorised for the payouts API.",
      );
    }
    return;
  }

  const rows = Array.isArray(list.body)
    ? list.body
    : ((list.body as { data?: unknown[] })?.data ?? []);
  const first = rows[0] as { uuid?: string } | undefined;
  if (!first?.uuid) {
    console.log("\nNo payouts returned — nothing more to check.");
    return;
  }

  const exportUrl = `${base}/stores/${storeUuid}/payouts/${first.uuid}/export-json`;
  console.log(`\nGET ${exportUrl}`);
  const exp = await hit(exportUrl);
  console.log("  status:", exp.status, exp.ok ? "OK" : "FAIL");
  console.log("  body  :", JSON.stringify(exp.body, null, 2).slice(0, 2000));
  console.log(
    "\nExpect either an array of order rows (with merchantReference) or { url: <download link> }.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
