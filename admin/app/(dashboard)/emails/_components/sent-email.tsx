"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../lib/failure-message";
import { formatDate } from "../../../../lib/dates";
import { readJson } from "../../../../lib/read-json";
import { EmailPreview } from "./email-preview";
import { NewEmailButton } from "./new-email-button";
import type { Campaign, EmailOptions, Locale } from "./types";

/** How often the page asks how far sending has got, while it's going. */
const POLL_MS = 5000;

/**
 * An email that's been sent, or is being: how far it's got, the copies that
 * failed and why, and the email as it was sent.
 */
export function SentEmail({
  campaign: loaded,
  options,
}: {
  campaign: Campaign;
  options: EmailOptions;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale | null>(null);
  const [error, setError] = useState<string | null>(null);
  // While it's being sent, the page asks for the email alone, not the whole
  // page again: that's several requests to the backend each time, which on
  // a long send would add up to its limit. What it's told is of the page it
  // asked from, and a newer page, as after continuing, starts over. It asks
  // while sending is stopped too: it goes on by itself after a deploy.
  const [polled, setPolled] = useState<{ from: Campaign; to: Campaign }>();
  const campaign = polled?.from === loaded ? polled.to : loaded;
  const { progress } = campaign;
  const sending = campaign.status === "sending";

  useEffect(() => {
    if (!sending) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function poll() {
      // not while no one's looking
      if (!document.hidden) {
        try {
          const res = await fetch(`/api/emails/${loaded.id}`);
          if (res.ok) {
            const { data } = await readJson<{ data: Campaign }>(res);
            if (!stopped) setPolled({ from: loaded, to: data });
          }
        } catch {
          // the next one tries again
        }
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }
    timer = setTimeout(poll, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [sending, loaded]);

  async function sendAgain() {
    setError(null);
    try {
      const res = await fetch(`/api/emails/${campaign.id}/send`, {
        method: "POST",
      });
      if (!res.ok) setError(await failureMessage(res, "Couldn't send."));
      router.refresh();
    } catch {
      setError(CONNECTION_FAILED);
    }
  }

  const kind =
    options.kinds.find((option) => option.value === campaign.kind)?.label ??
    campaign.kind;
  // Of those still to go, the ones waiting to be tried again, their
  // addresses refused for now: sending goes on with them by itself then.
  const waiting = progress.waiting ?? 0;
  const due = progress.queued - waiting;
  // Sending that stopped without finishing: the server restarted, or it
  // stopped for something it couldn't get past. Not when all that's left
  // is waiting, unless it's waiting for the team too.
  const cutOff =
    campaign.status === "sending" &&
    !progress.running &&
    (due > 0 || waiting === 0 || Boolean(campaign.heldFor));
  const stoppedBy = campaign.heldFor ?? progress.stoppedBy;
  const total =
    progress.queued +
    progress.sending +
    progress.sent +
    progress.failed +
    progress.skipped;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
      <div className="min-w-0 space-y-6">
        <section className="space-y-2 rounded-lg border bg-card p-5 text-sm">
          <p>
            <span className="text-muted-foreground">Type: </span>
            {kind}
          </p>
          <p className="text-base">
            <span className="font-semibold">{progress.sent}</span> of {total}{" "}
            sent
            {progress.failed > 0 && (
              <>
                ,{" "}
                <span className="font-semibold text-destructive">
                  {progress.failed}
                </span>{" "}
                failed
              </>
            )}
            {progress.running && " so far…"}
          </p>
          {campaign.sentAt && !progress.running && (
            <p className="text-muted-foreground">
              Finished {formatDate(campaign.sentAt, true)}
            </p>
          )}
          {progress.skipped > 0 && (
            <p className="text-muted-foreground">
              {progress.skipped} {progress.skipped === 1 ? "donor" : "donors"}{" "}
              turned these emails off before their copy went out.
            </p>
          )}
          {cutOff && (
            <p className="text-amber-700 dark:text-amber-400">
              Sending stopped before it finished
              {stoppedBy ? `: ${stoppedBy}` : ""}.{" "}
              {campaign.heldFor &&
                "That looks like the mail server's trouble, so it waits for you rather than going on by itself. "}
              {due > 0
                ? `Continuing sends the ${due} still to go, to the donors who were in the group when it was first sent, and no one else.`
                : waiting > 0
                  ? "Continuing lets the ones waiting go when they're due."
                  : "Nothing is left to send: continuing marks it as sent."}
            </p>
          )}
          {campaign.status === "sending" && waiting > 0 && (
            <p className="text-muted-foreground">
              {waiting} {waiting === 1 ? "copy" : "copies"} whose address the
              mail server refused for now {waiting === 1 ? "waits" : "wait"} to
              be tried again
              {progress.nextTry
                ? `, from ${formatDate(progress.nextTry, true)}`
                : ""}
              {campaign.heldFor ? "." : ": sending goes on by itself then."}
            </p>
          )}
          {!progress.running && progress.sending > 0 && (
            <p className="text-amber-700 dark:text-amber-400">
              {progress.sending}{" "}
              {progress.sending === 1 ? "copy was" : "copies were"} cut off
              while being sent and may not have gone out;{" "}
              {progress.sending === 1 ? "it isn't" : "they aren't"} sent again.
            </p>
          )}
          {progress.failures.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-auto text-xs text-muted-foreground">
              {progress.failures.map((failure) => (
                <li key={failure.donorId}>
                  <Link
                    href={`/donors/${failure.donorId}`}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Donor #{failure.donorId}
                  </Link>
                  : {failure.error}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            {!progress.running && (cutOff || progress.failed > 0) && (
              <Button size="sm" onClick={sendAgain}>
                {cutOff ? "Continue sending" : "Try the failed ones again"}
              </Button>
            )}
            <NewEmailButton copyOf={campaign.id} variant="outline">
              Duplicate as a new draft
            </NewEmailButton>
          </div>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </section>
      </div>
      <EmailPreview
        draft={{
          kind: campaign.kind,
          content: campaign.content,
          audience: campaign.audience,
        }}
        donorId={null}
        locale={locale}
        onLocaleChange={setLocale}
      />
    </div>
  );
}
