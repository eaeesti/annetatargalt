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

  const listUrl = `${base}/stores/${storeUuid}/payouts?limit=149&offset=0&order=DESC`;
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

  const b = list.body as unknown[] | { payouts?: unknown[]; data?: unknown[] };
  const rows = (Array.isArray(b) ? b : (b.payouts ?? b.data ?? [])) as {
    uuid?: string;
    totalAmount?: string;
    createdAt?: string;
    settlementType?: string;
  }[];
  rows.sort(
    (x, y) => Date.parse(y.createdAt ?? "") - Date.parse(x.createdAt ?? ""),
  );
  console.log(`\n${rows.length} payouts. Newest 8:`);
  for (const p of rows.slice(0, 8)) {
    console.log(
      `  ${p.createdAt?.slice(0, 10)}  ${String(p.totalAmount).padStart(9)}  ${p.settlementType}  ${p.uuid}`,
    );
  }
  const first = rows[0];
  if (!first?.uuid) {
    console.log("\nNo payouts returned — nothing more to check.");
    return;
  }

  const exportUrl = `${base}/stores/${storeUuid}/payouts/${first.uuid}/export-json`;
  console.log(`\nGET ${exportUrl}`);
  const exp = await hit(exportUrl);
  console.log("  status:", exp.status, exp.ok ? "OK" : "FAIL");

  const file = (exp.body as { url?: string })?.url;
  if (file) {
    const fres = await fetch(file);
    const ftext = await fres.text();
    let fbody: unknown = ftext;
    try {
      fbody = JSON.parse(ftext);
    } catch {
      /* text */
    }
    const orderRows = Array.isArray(fbody)
      ? fbody
      : ((fbody as { orders?: unknown[] })?.orders ?? []);
    console.log(`  → file ${fres.status}, ${orderRows.length} order rows`);
    console.log(
      "  first 2:",
      JSON.stringify(orderRows.slice(0, 2), null, 2).slice(0, 2000),
    );
  } else {
    console.log("  body:", JSON.stringify(exp.body, null, 2).slice(0, 2000));
  }
  console.log(
    "\nWhat matters: which field on an order row carries our merchant reference / trailing donation id.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
