/**
 * Stand-ins for the outside services the backend talks to, so a test run
 * never reaches a real one:
 *
 * - Montonio: POST /orders takes an order token as the backend sends it and
 *   answers with a payment page here, /pay/<id>. That page is the bank: its
 *   buttons report the payment to the backend's notification URL, as
 *   Montonio does, and then send the browser back to the site.
 * - Email: an SMTP server (with STARTTLS, which the backend insists on) keeps
 *   every message it gets. GET /emails lists them for the tests.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";
import { CERT_FILE, KEY_FILE, MONTONIO, PORTS } from "./config.ts";
import { signJwt, verifyJwt } from "./jwt.ts";

export interface Email {
  to: string[];
  from: string;
  subject: string;
  text: string;
  html: string;
  receivedAt: string;
}

export interface Order {
  id: number;
  merchantReference: string;
  returnUrl: string;
  notificationUrl: string;
  grandTotal: number;
  method: string;
  /** What the bank page reported: "PAID", "ABANDONED", or nothing yet. */
  status: string | null;
}

const emails: Email[] = [];
const orders: Order[] = [];

function makeCertificate() {
  if (existsSync(CERT_FILE) && existsSync(KEY_FILE)) return;
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "3650",
      "-keyout",
      KEY_FILE,
      "-out",
      CERT_FILE,
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
}

function startSmtp() {
  const smtp = new SMTPServer({
    key: readFileSync(KEY_FILE),
    cert: readFileSync(CERT_FILE),
    authOptional: true,
    logger: false,
    onAuth(_auth, _session, callback) {
      callback(null, { user: "e2e" });
    },
    onData(stream, session, callback) {
      simpleParser(stream)
        .then((parsed) => {
          emails.push({
            to: session.envelope.rcptTo.map((r) => r.address.toLowerCase()),
            from: parsed.from?.text ?? "",
            subject: parsed.subject ?? "",
            text: parsed.text ?? "",
            html: typeof parsed.html === "string" ? parsed.html : "",
            receivedAt: new Date().toISOString(),
          });
          callback();
        })
        .catch((error: unknown) =>
          callback(error instanceof Error ? error : new Error(String(error))),
        );
    },
  });
  smtp.listen(PORTS.smtp, "127.0.0.1");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

function createOrder(token: string): Order | null {
  const payload = verifyJwt(token, MONTONIO.privateKey);
  if (!payload || payload.accessKey !== MONTONIO.publicKey) return null;
  const payment = payload.payment;
  const method =
    typeof payment === "object" && payment !== null && "method" in payment
      ? str(payment.method)
      : "";
  const order: Order = {
    id: orders.length + 1,
    merchantReference: str(payload.merchantReference),
    returnUrl: str(payload.returnUrl),
    notificationUrl: str(payload.notificationUrl),
    grandTotal: Number(payload.grandTotal),
    method,
    status: null,
  };
  orders.push(order);
  return order;
}

const escape = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );

function paymentPage(order: Order) {
  return `<!doctype html><title>Fake bank</title>
<h1>Fake bank</h1>
<p>Payment for <strong>${escape(order.merchantReference)}</strong>:
<strong data-testid="amount">${order.grandTotal.toFixed(2)} EUR</strong></p>
<form method="post" action="/pay/${order.id}/PAID"><button>Approve payment</button></form>
<form method="post" action="/pay/${order.id}/ABANDONED"><button>Abandon</button></form>`;
}

/** Reports the payment to the backend, then sends the browser back. */
async function finishPayment(
  order: Order,
  status: string,
  res: ServerResponse,
) {
  order.status = status;
  const token = signJwt(
    {
      accessKey: MONTONIO.publicKey,
      merchant_reference: order.merchantReference,
      paymentStatus: status,
      customer_iban:
        order.method === "cardPayments" ? null : "EE382200221020145685",
      payment_method_name:
        order.method === "cardPayments" ? "Card" : "Fake bank",
    },
    MONTONIO.privateKey,
  );
  const query = new URLSearchParams({ "order-token": token });
  const notified = await fetch(`${order.notificationUrl}?${query}`, {
    method: "POST",
  });
  // A refusal is the test's failure, so it shows here rather than as a
  // missing email or row later.
  if (!notified.ok) {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(
      `The backend refused the payment notification (${notified.status}): ${await notified.text()}`,
    );
    return;
  }
  const back = new URL(order.returnUrl);
  back.searchParams.set("order-token", token);
  res.writeHead(303, { Location: back.toString() });
  res.end();
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (req.method === "GET" && path === "/health") return json(res, 200, "ok");

  if (req.method === "GET" && path === "/emails") {
    const to = url.searchParams.get("to")?.toLowerCase();
    return json(
      res,
      200,
      to ? emails.filter((e) => e.to.includes(to)) : emails,
    );
  }

  if (req.method === "GET" && path === "/orders") return json(res, 200, orders);

  if (req.method === "POST" && path === "/orders") {
    const body: unknown = JSON.parse((await readBody(req)) || "{}");
    const token =
      typeof body === "object" && body !== null && "data" in body
        ? str(body.data)
        : "";
    const order = createOrder(token);
    if (!order) return json(res, 401, { message: "Invalid token" });
    return json(res, 200, {
      paymentUrl: `http://127.0.0.1:${PORTS.fakes}/pay/${order.id}`,
    });
  }

  const pay = path.match(/^\/pay\/(\d+)(?:\/(PAID|ABANDONED))?$/);
  const order = pay ? orders.find((o) => o.id === Number(pay[1])) : undefined;
  if (pay && order) {
    if (req.method === "GET" && !pay[2]) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(paymentPage(order));
    }
    if (req.method === "POST" && pay[2]) {
      return finishPayment(order, pay[2], res);
    }
  }

  json(res, 404, { message: "Not found" });
}

makeCertificate();
startSmtp();
createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    console.error(error);
    json(res, 500, { message: String(error) });
  });
}).listen(PORTS.fakes, "127.0.0.1", () => {
  console.log(`Fakes on ${PORTS.fakes}, SMTP on ${PORTS.smtp}`);
});
