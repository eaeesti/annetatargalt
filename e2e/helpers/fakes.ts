import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { URLS } from "../stack/config.ts";
import { isRecord } from "./narrow.ts";
import type { Email, Order } from "../stack/fakes.ts";

function isEmail(value: unknown): value is Email {
  return (
    isRecord(value) &&
    Array.isArray(value.to) &&
    typeof value.subject === "string" &&
    typeof value.text === "string" &&
    typeof value.html === "string"
  );
}

function isOrder(value: unknown): value is Order {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.merchantReference === "string"
  );
}

/** An address no other test uses, so its emails are this test's own. */
export function uniqueEmail(name = "donor") {
  return `${name}-${randomUUID().slice(0, 8)}@e2e.test`;
}

/** The emails the fake mail server got for an address. */
export async function emailsTo(address: string): Promise<Email[]> {
  const response = await fetch(
    `${URLS.fakes}/emails?${new URLSearchParams({ to: address })}`,
  );
  const body: unknown = await response.json();
  return Array.isArray(body) ? body.filter(isEmail) : [];
}

/**
 * Waits for an email to the address whose subject matches and, if given,
 * whose text has `containing` in it.
 */
export async function waitForEmail(
  address: string,
  subject: string | RegExp,
  containing = "",
): Promise<Email> {
  const matches = (email: Email) =>
    (typeof subject === "string"
      ? email.subject.includes(subject)
      : subject.test(email.subject)) && email.text.includes(containing);
  let found: Email | undefined;
  await expect
    .poll(
      async () => {
        found = (await emailsTo(address)).find(matches);
        return Boolean(found);
      },
      { message: `an email to ${address} about ${String(subject)}` },
    )
    .toBe(true);
  if (!found) throw new Error("unreachable");
  return found;
}

/** The payment orders the fake Montonio got, oldest first. */
export async function orders(): Promise<Order[]> {
  const response = await fetch(`${URLS.fakes}/orders`);
  const body: unknown = await response.json();
  return Array.isArray(body) ? body.filter(isOrder) : [];
}

/** The order whose payment page is open: the fake bank's /pay/<id>. */
export async function orderOnPage(url: string): Promise<Order | undefined> {
  const id = Number(new URL(url).pathname.split("/").pop());
  return (await orders()).find((order) => order.id === id);
}
