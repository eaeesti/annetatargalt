"use client";

import { useEffect, useState } from "react";
import { readJson } from "../../../../lib/read-json";
import { TraitPicker } from "./trait-picker";
import {
  LANGUAGES,
  type Audience,
  type EmailContent,
  type EmailOptions,
  type Locale,
  type Traits,
} from "./types";

interface Preview {
  donorId: number | null;
  locale: Locale;
  subject: string;
  html: string;
  /** How many in the group are what the traits ask. */
  matching: number;
}

/** How long typing has to pause before the preview follows. */
const SETTLE_MS = 700;

/**
 * An email's HTML with its links opening in a new tab. In the preview frame
 * they'd open inside it, where most sites refuse to be shown.
 */
function withLinksInNewTabs(html: string): string {
  const base = '<base target="_blank">';
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (head) => head + base)
    : base + html;
}

/**
 * The email as a donor in its group gets it: `donorId`, or the first who is
 * what `traits` asks, or the first of the group, or someone made up when
 * there's no one in it. Their language can be switched, to check both.
 */

export function EmailPreview({
  draft,
  donorId,
  traits = {},
  locale,
  traitOptions,
  onTraitsChange,
  onLocaleChange,
}: {
  draft: { kind: string; content: EmailContent; audience: Audience };
  donorId: number | null;
  traits?: Traits;
  locale: Locale | null;
  /** The traits to choose from; no choice without them. */
  traitOptions?: EmailOptions["traits"];
  onTraitsChange?: (traits: Traits) => void;
  onLocaleChange: (locale: Locale | null) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const request = JSON.stringify({ ...draft, donorId, traits, locale });
  const asked = !donorId && Object.keys(traits).length > 0;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/emails/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: request,
        signal: controller.signal,
      })
        .then(async (res) => {
          setFailed(!res.ok);
          if (res.ok) setPreview((await readJson<{ data: Preview }>(res)).data);
        })
        // a newer preview took over, or the next one will try again
        .catch(() => {});
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [request]);

  return (
    <aside className="min-w-0 space-y-2 xl:sticky xl:top-4 xl:self-start">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold tracking-wide text-muted-foreground uppercase">
          Preview
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {preview?.donorId
            ? `as donor #${preview.donorId}`
            : "as an example donor"}
          <select
            aria-label="Language"
            className="h-7 rounded-md border border-input bg-transparent px-1.5 text-foreground"
            value={locale ?? ""}
            onChange={(event) =>
              onLocaleChange(
                LANGUAGES.find((l) => l.locale === event.target.value)
                  ?.locale ?? null,
              )
            }
          >
            <option value="">in their language</option>
            {LANGUAGES.map((language) => (
              <option key={language.locale} value={language.locale}>
                in {language.label}
              </option>
            ))}
          </select>
        </span>
      </div>
      {traitOptions && onTraitsChange && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Show as a donor who is</span>
          <TraitPicker
            options={traitOptions}
            traits={donorId ? {} : traits}
            period={draft.audience.period}
            onChange={onTraitsChange}
          />
          {asked && preview && (
            <span
              className={
                preview.matching === 0
                  ? "text-destructive"
                  : "text-muted-foreground"
              }
            >
              {preview.matching === 0
                ? "No one in the group is all of these: showing the first donor."
                : `${preview.matching} in the group ${preview.matching === 1 ? "is" : "are"}.`}
            </span>
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-4 py-2 text-sm">
          <span className="text-muted-foreground">Subject: </span>
          <span className="font-medium">{preview?.subject || "…"}</span>
        </div>
        {failed && (
          <p className="px-4 py-2 text-sm text-destructive">
            Couldn&apos;t show the preview.
          </p>
        )}
        <iframe
          title="Email preview"
          // the email's own HTML, with no scripts and no reach into the page;
          // its links open in a tab of their own, as from a mail client
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          srcDoc={withLinksInNewTabs(preview?.html ?? "")}
          className="h-[70vh] w-full bg-white"
        />
      </div>
    </aside>
  );
}
