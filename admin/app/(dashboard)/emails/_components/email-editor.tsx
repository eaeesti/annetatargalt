"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { ConfirmButton } from "../../../../components/confirm-button";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../lib/failure-message";
import { readJson } from "../../../../lib/read-json";
import { cn } from "@/lib/utils";
import { VariableText } from "./variable-text";
import { AddImage } from "./add-image";
import { EmailPreview } from "./email-preview";
import { TraitPicker } from "./trait-picker";
import {
  LANGUAGES,
  isWholeYear,
  type Audience,
  type Campaign,
  type Check,
  type EmailContent,
  type EmailOptions,
  type Locale,
  type Localized,
  type Traits,
} from "./types";

/** How long typing has to pause before the email is saved and checked. */
const SETTLE_MS = 700;

/** The most a request that outlives the page can carry, in bytes. */
const KEEPALIVE_BYTES = 64 * 1024;

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A select for a yes/no filter, where "either" leaves it out. */
function FilterSelect({
  label,
  value,
  onChange,
  yes,
  no,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  yes: string;
  no: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="h-8 rounded-lg border border-input bg-transparent px-2"
        value={value === undefined ? "" : String(value)}
        onChange={(event) =>
          onChange(
            event.target.value === ""
              ? undefined
              : event.target.value === "true",
          )
        }
      >
        <option value="">Anyone</option>
        <option value="true">{yes}</option>
        <option value="false">{no}</option>
      </select>
    </label>
  );
}

/** A year as a period, from its first day to its last. */
function wholeYear(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** `text` with `paragraph` after it, a blank line between them. */
function withParagraph(text: string, paragraph: string): string {
  return text.trim() ? `${text.trimEnd()}\n\n${paragraph}` : paragraph;
}

/** A new block's id, unique within the email. */
function newBlockId(content: EmailContent): string {
  return String(
    Math.max(0, ...content.blocks.map((block) => Number(block.id) || 0)) + 1,
  );
}

/**
 * A draft email: who it goes to, its subject and text, what's wrong with
 * it, how it looks to a donor, and sending it. Changes save on their own.
 */
export function EmailEditor({
  campaign,
  options,
}: {
  campaign: Campaign;
  options: EmailOptions;
}) {
  const router = useRouter();
  const [name, setName] = useState(campaign.name);
  const [kind, setKind] = useState(campaign.kind);
  const [audience, setAudience] = useState<Audience>(campaign.audience);
  const [content, setContent] = useState<EmailContent>(campaign.content);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [check, setCheck] = useState<Check | null>(null);
  // The email as it was when `check` was made of it, and in which round:
  // a new round checks the same email again.
  const [checkedJson, setCheckedJson] = useState<string | null>(null);
  const [checkRound, setCheckRound] = useState(0);
  // Why the check of the email, as it was in which round, failed.
  const [checkFailure, setCheckFailure] = useState<{
    of: string;
    message: string;
  } | null>(null);
  const [showRecipients, setShowRecipients] = useState(false);
  const [testState, setTestState] = useState<string | null>(null);
  const [previewDonor, setPreviewDonor] = useState<number | null>(null);
  const [previewLocale, setPreviewLocale] = useState<Locale | null>(null);
  const [previewTraits, setPreviewTraits] = useState<Traits>({});
  // As typed; the audience gets them once they make an address or a period.
  const [addressText, setAddressText] = useState(
    Array.isArray(campaign.audience.emails)
      ? campaign.audience.emails.join("\n")
      : (campaign.audience.emails ?? ""),
  );
  const [periodFrom, setPeriodFrom] = useState(
    campaign.audience.period?.from ?? "",
  );
  const [periodTo, setPeriodTo] = useState(campaign.audience.period?.to ?? "");
  // As typed, so it can be emptied: an empty rate is the default one.
  const [taxRateText, setTaxRateText] = useState(
    String(campaign.content.taxRate ?? options.defaultTaxRate),
  );

  /** The period as typed: in the audience once both days are there, in order. */
  function choosePeriod(from: string, to: string) {
    setPeriodFrom(from);
    setPeriodTo(to);
    setAudience({
      ...audience,
      period: from && to && from <= to ? { from, to } : undefined,
    });
  }

  // A summary's variables only once the email has a period to sum up, and
  // the tax limit's once that's a whole year, which the limit is for.
  const variables = (
    options.kinds.find((option) => option.value === kind)?.variables ?? []
  ).filter(
    (variable) =>
      (audience.period || !variable.needsPeriod) &&
      (isWholeYear(audience.period) || !variable.needsYear),
  );
  const subjectVariables = variables.filter(
    (variable) => variable.inSubject !== false,
  );
  const draft = { kind, content, audience };
  const draftJson = JSON.stringify(draft);

  // Save after a pause in typing. Saves go one at a time, each after the one
  // before, so an older one can never land after a newer one.
  const saved = useRef(JSON.stringify({ name, ...draft }));
  const lastSave = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const body = JSON.stringify({ name, ...draft });

  // Each save says which editor, this tab, makes it, and is numbered after
  // the one before it: the backend leaves out one that arrives after a
  // later one from the same editor, as an autosave still on its way can
  // when the tab closes.
  const [editor] = useState(() => crypto.randomUUID());
  const saves = useRef(0);
  const numbered = useCallback(
    (json: string) => {
      saves.current += 1;
      return `{"editor":"${editor}","save":${saves.current},${json.slice(1)}`;
    },
    [editor],
  );

  const save = useCallback(
    (json: string) => {
      lastSave.current = lastSave.current
        .then(async () => {
          if (json === saved.current) return true;
          const res = await fetch(`/api/emails/${campaign.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: numbered(json),
          });
          if (res.ok) saved.current = json;
          // A later save of this tab's arrived first, as the one sent when
          // the tab was left: the email is saved, newer than this.
          return res.ok || res.status === 409;
        })
        .catch(() => false)
        .then((ok) => {
          setSaveState(ok ? "saved" : "error");
          return ok;
        });
      return lastSave.current;
    },
    [campaign.id, numbered],
  );

  useEffect(() => {
    if (body !== saved.current) setSaveState("saving");
    saveTimer.current = setTimeout(() => void save(body), SETTLE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [body, save]);

  // Leaving the page, by a link or by closing the tab, before the pause
  // that saves what was last typed: it's sent then. By a link, the page
  // stays, and so does the queue of saves. Closing the tab, in a request
  // that outlives the page, which browsers limit in size: for an email
  // longer than that, the browser asks first whether to leave. Either is
  // saved only once it's arrived: a page brought back with Back sends again
  // what didn't.
  const latest = useRef(body);
  useEffect(() => {
    latest.current = body;
  }, [body]);
  useEffect(() => {
    const unsaved = () => latest.current !== saved.current;
    // With room for the save's number
    const tooLong = () =>
      new Blob([latest.current]).size > KEEPALIVE_BYTES - 64;
    function close() {
      if (!unsaved()) return;
      clearTimeout(saveTimer.current);
      const json = latest.current;
      void fetch(`/api/emails/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: numbered(json),
        keepalive: !tooLong(),
      })
        .then((res) => {
          if (res.ok) saved.current = json;
        })
        .catch(() => {});
    }
    function warn(event: BeforeUnloadEvent) {
      if (unsaved() && tooLong()) event.preventDefault();
    }
    function back(event: PageTransitionEvent) {
      if (event.persisted) void save(latest.current);
    }
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", close);
    window.addEventListener("pageshow", back);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("pagehide", close);
      window.removeEventListener("pageshow", back);
      clearTimeout(saveTimer.current);
      // The page the link opens can be drawn before this arrives, as the
      // list of emails with the old name: it's drawn again once it has.
      const unsaved = latest.current !== saved.current;
      void save(latest.current).then((ok) => {
        if (unsaved && ok) router.refresh();
      });
    };
  }, [campaign.id, save, numbered, router]);

  // Who it goes to and what's wrong with it, after a pause in typing.
  useEffect(() => {
    const controller = new AbortController();
    const of = `${checkRound}:${draftJson}`;
    const timer = setTimeout(() => {
      fetch("/api/emails/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: draftJson,
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const message = await failureMessage(
              res,
              "Couldn't check the email.",
            );
            setCheckFailure({ of, message });
            return;
          }
          setCheck((await readJson<{ data: Check }>(res)).data);
          setCheckedJson(of);
        })
        .catch(() => {
          // unless a newer check took over
          if (!controller.signal.aborted) {
            setCheckFailure({ of, message: CONNECTION_FAILED });
          }
        });
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draftJson, checkRound]);

  /**
   * Save the changes now, for a test or the send, rather than after the
   * pause: the email may not be a draft any more by then.
   */
  function savedNow(): Promise<boolean> {
    clearTimeout(saveTimer.current);
    return save(body);
  }

  function updateBlock(
    index: number,
    change: Partial<EmailContent["blocks"][number]>,
  ) {
    setContent({
      ...content,
      blocks: content.blocks.map((block, i) =>
        i === index ? { ...block, ...change } : block,
      ),
    });
  }

  /**
   * Put a picture at the end of a block's text, as the text is when the
   * upload finishes: it may have been typed on, or the block moved, since
   * the picture was chosen. Nothing happens if the block has been removed.
   * A block with no English gets none: English readers get the Estonian
   * text then, picture and all, which a picture of their own would hide.
   */
  function addPicture(blockId: string, picture: Localized) {
    setContent((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              text: {
                et: withParagraph(block.text.et, picture.et),
                en: block.text.en.trim()
                  ? withParagraph(block.text.en, picture.en)
                  : block.text.en,
              },
            }
          : block,
      ),
    }));
  }

  function removeBlock(blockId: string) {
    setContent((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== blockId),
    }));
  }

  function moveBlock(index: number, step: number) {
    const blocks = [...content.blocks];
    const [block] = blocks.splice(index, 1);
    if (!block) return;
    blocks.splice(index + step, 0, block);
    setContent({ ...content, blocks });
  }

  async function sendTest() {
    setTestState("Sending…");
    try {
      if (!(await savedNow())) {
        setTestState("Couldn't save the email first.");
        return;
      }
      const res = await fetch(`/api/emails/${campaign.id}/test`, {
        method: "POST",
      });
      if (!res.ok) {
        setTestState(await failureMessage(res, "Couldn't send the test."));
        return;
      }
      const { data } = await readJson<{ data: { to: string } }>(res);
      setTestState(`Sent to ${data.to}`);
    } catch {
      setTestState(CONNECTION_FAILED);
    }
  }

  async function send(): Promise<string | null> {
    if (!(await savedNow())) return "Couldn't save the email first.";
    // The number the admin agreed to: the backend refuses if it's changed.
    const res = await fetch(`/api/emails/${campaign.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    if (!res.ok) {
      // The group changed since it was counted: count it again.
      if (res.status === 409) setCheckRound((round) => round + 1);
      return failureMessage(res, "Couldn't start sending.");
    }
    router.refresh();
    return null;
  }

  async function remove(): Promise<string | null> {
    const res = await fetch(`/api/emails/${campaign.id}`, { method: "DELETE" });
    if (!res.ok) return failureMessage(res, "Couldn't delete the draft.");
    router.push("/emails");
    router.refresh();
    return null;
  }

  const errors =
    check?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warnings =
    check?.issues.filter((issue) => issue.severity === "warning") ?? [];
  const count = check?.count ?? 0;
  // A rate that isn't one isn't used: the default would be, unseen.
  const typedRate = Number(taxRateText);
  const taxRateWrong =
    Boolean(audience.period) &&
    taxRateText !== "" &&
    !(typedRate >= 0 && typedRate <= 100);
  // The count is of what was last checked: not to be sent on until it's of
  // the email as it is.
  const checkOf = `${checkRound}:${draftJson}`;
  const checked = checkedJson === checkOf;
  const checkFailed =
    checkFailure?.of === checkOf ? checkFailure.message : null;
  // In the dialog too: the group is counted again there when it's changed.
  const cantSend =
    !check || !checked || errors.length > 0 || count === 0 || taxRateWrong;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            aria-label="Name"
            placeholder="Name, for the team"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 max-w-md text-base font-semibold"
          />
          <span
            className={cn(
              "text-xs",
              saveState === "error"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
            role="status"
          >
            {saveState === "error" ? (
              <>
                Couldn&apos;t save.{" "}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => {
                    setSaveState("saving");
                    void savedNow();
                  }}
                >
                  Try again
                </button>
              </>
            ) : saveState === "saving" ? (
              "Saving…"
            ) : (
              "Saved"
            )}
          </span>
        </div>

        <Section title="Who gets it">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Type</span>
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                {options.kinds.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Language</span>
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2"
                value={audience.locale ?? ""}
                onChange={(event) => {
                  const locale = LANGUAGES.find(
                    (language) => language.locale === event.target.value,
                  )?.locale;
                  setAudience({ ...audience, locale });
                }}
              >
                <option value="">Any</option>
                {LANGUAGES.map((language) => (
                  <option key={language.locale} value={language.locale}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>
            <FilterSelect
              label="Recurring"
              value={audience.recurring}
              onChange={(recurring) => setAudience({ ...audience, recurring })}
              yes="Recurring donors"
              no="Not recurring"
            />
            <FilterSelect
              label="ID code"
              value={audience.hasIdCode}
              onChange={(hasIdCode) => setAudience({ ...audience, hasIdCode })}
              yes="Has one"
              no="Has none"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Gave between</span>
              <Input
                type="date"
                value={periodFrom}
                onChange={(event) => choosePeriod(event.target.value, periodTo)}
                className="h-8 w-40"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">and</span>
              <Input
                type="date"
                value={periodTo}
                onChange={(event) =>
                  choosePeriod(periodFrom, event.target.value)
                }
                className="h-8 w-40"
              />
            </label>
            {/* together, onto a line of their own when there's no room */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const { from, to } = wholeYear(new Date().getFullYear() - 1);
                  choosePeriod(from, to);
                }}
              >
                Last year
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const { from, to } = wholeYear(new Date().getFullYear());
                  choosePeriod(from, to);
                }}
              >
                This year
              </Button>
              {(periodFrom || periodTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => choosePeriod("", "")}
                >
                  Any time
                </Button>
              )}
            </div>
          </div>
          {audience.period && (
            <label className="flex w-fit flex-col gap-1 text-sm">
              <span className="text-muted-foreground">
                Income tax rate, for the refund
              </span>
              <span className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={taxRateText}
                  // an empty one is the default
                  placeholder={String(options.defaultTaxRate)}
                  aria-invalid={taxRateWrong}
                  onChange={(event) => {
                    setTaxRateText(event.target.value);
                    const rate = Number(event.target.value);
                    setContent({
                      ...content,
                      taxRate:
                        event.target.value !== "" && rate >= 0 && rate <= 100
                          ? rate
                          : undefined,
                    });
                  }}
                  className="h-8 w-20"
                />
                %
              </span>
            </label>
          )}
          {periodFrom && periodTo && periodFrom > periodTo && (
            <p className="text-sm text-destructive">
              The first day is after the last.
            </p>
          )}
          {taxRateWrong && (
            <p className="text-sm text-destructive">
              The tax rate is a percent, from 0 to 100.
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">
              Only these addresses, such as the team&apos;s for a first send.
              One per line; leave it empty for everyone in the group.
            </span>
            <Textarea
              value={addressText}
              rows={2}
              placeholder="name@example.org"
              onChange={(event) => {
                setAddressText(event.target.value);
                setAudience({
                  ...audience,
                  // The backend reads the addresses from it, as the email's
                  // check shows. Nothing but the spaces, commas and
                  // semicolons between them is no list, as it reads it.
                  emails: /[^\s,;]/.test(event.target.value)
                    ? event.target.value
                    : undefined,
                });
              }}
              className="max-w-xl font-mono text-xs"
            />
          </label>
          <p className="text-sm">
            {check ? (
              <>
                <span className="font-semibold">
                  {count} {count === 1 ? "donor" : "donors"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {audience.period
                    ? `who gave between ${audience.period.from} and ${audience.period.to}`
                    : "who gave at least once"}
                  {audience.emails ? ", at the addresses above," : ""} and
                  haven&apos;t turned this kind of email off.
                </span>{" "}
                {count > 0 && (
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => setShowRecipients(!showRecipients)}
                  >
                    {showRecipients ? "Hide them" : "Show them"}
                  </button>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                {checkFailed ? "Couldn't count them." : "Counting…"}
              </span>
            )}
          </p>
          {showRecipients && check && (
            <ul className="max-h-64 divide-y overflow-auto rounded-md border text-sm">
              {check.recipients.map((recipient) => (
                <li
                  key={recipient.donorId}
                  className="flex items-center justify-between gap-3 px-3 py-1.5"
                >
                  <span className="truncate">
                    {recipient.name || recipient.email}{" "}
                    <span className="text-muted-foreground">
                      {recipient.name && recipient.email}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {recipient.locale.toUpperCase()}
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2"
                      onClick={() => {
                        setPreviewDonor(recipient.donorId);
                        setPreviewTraits({});
                        setPreviewLocale(null);
                      }}
                    >
                      Preview
                    </button>
                  </span>
                </li>
              ))}
              {check.count > check.recipients.length && (
                <li className="px-3 py-1.5 text-muted-foreground">
                  …and {check.count - check.recipients.length} more
                </li>
              )}
            </ul>
          )}
        </Section>

        <Section title="Subject">
          <div className="grid gap-3 lg:grid-cols-2">
            {LANGUAGES.map(({ locale, label }) => (
              <div key={locale} className="space-y-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <VariableText
                  label={`${label} subject`}
                  singleLine
                  value={content.subject[locale]}
                  variables={subjectVariables}
                  onChange={(value) =>
                    setContent({
                      ...content,
                      subject: { ...content.subject, [locale]: value },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Text"
          aside={
            <span className="text-xs text-muted-foreground">
              Markdown: **bold**, [link](https://…), - list
            </span>
          }
        >
          <div className="space-y-4">
            {content.blocks.map((block, index) => (
              <div key={block.id} className="space-y-3 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Block {index + 1}</span>
                  <span className="text-sm text-muted-foreground">
                    for donors who are
                  </span>
                  <TraitPicker
                    options={options.traits}
                    traits={block.traits}
                    period={audience.period}
                    onChange={(traits) => updateBlock(index, { traits })}
                  />
                  {check && (
                    <span className="text-xs text-muted-foreground">
                      reaches{" "}
                      {check.reach.find((r) => r.id === block.id)?.count ?? 0}{" "}
                      of {count}
                    </span>
                  )}
                  <span className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => moveBlock(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move down"
                      disabled={index === content.blocks.length - 1}
                      onClick={() => moveBlock(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    {block.text.et.trim() || block.text.en.trim() ? (
                      <ConfirmButton
                        title={`Remove block ${index + 1}?`}
                        description="Its text goes with it, in both languages."
                        confirmLabel="Remove"
                        action={async () => {
                          removeBlock(block.id);
                          return null;
                        }}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove block"
                            disabled={content.blocks.length === 1}
                          />
                        }
                      >
                        <Trash2 />
                      </ConfirmButton>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove block"
                        disabled={content.blocks.length === 1}
                        onClick={() => removeBlock(block.id)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {LANGUAGES.map(({ locale, label }) => (
                    <div key={locale} className="min-w-0 space-y-1">
                      <span className="text-xs text-muted-foreground">
                        {label}
                      </span>
                      <VariableText
                        label={`Block ${index + 1}, ${label}`}
                        value={block.text[locale]}
                        variables={variables}
                        onChange={(value) =>
                          updateBlock(index, {
                            text: { ...block.text, [locale]: value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <AddImage onAdd={(picture) => addPicture(block.id, picture)} />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setContent({
                  ...content,
                  blocks: [
                    ...content.blocks,
                    {
                      id: newBlockId(content),
                      traits: {},
                      text: { et: "", en: "" },
                    },
                  ],
                })
              }
            >
              <Plus /> Add a block
            </Button>
          </div>
        </Section>

        {(errors.length > 0 || warnings.length > 0) && (
          <Section title="Before sending">
            {/* a long address or link in one wraps, not out of the box */}
            <ul className="space-y-1.5 text-sm wrap-break-word">
              {errors.map((issue) => (
                <li key={issue.message} className="text-destructive">
                  {issue.message}
                </li>
              ))}
              {warnings.map((issue) => (
                <li
                  key={issue.message}
                  className="text-amber-700 dark:text-amber-400"
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <ConfirmButton
            title={`Send this email to ${count} ${count === 1 ? "donor" : "donors"}?`}
            description="It goes out one donor at a time, which takes a few minutes. It can't be changed after this."
            confirmLabel="Send"
            disabled={cantSend}
            action={send}
            trigger={<Button disabled={cantSend} />}
          >
            {checked
              ? `Send to ${count} ${count === 1 ? "donor" : "donors"}`
              : checkFailed
                ? "Couldn't check"
                : "Checking…"}
          </ConfirmButton>
          {checkFailed && (
            <span className="text-sm text-destructive" role="alert">
              {checkFailed}{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setCheckRound((round) => round + 1)}
              >
                Check again
              </button>
            </span>
          )}
          <Button variant="outline" onClick={sendTest}>
            Send a test to me
          </Button>
          {testState && (
            <span className="text-sm text-muted-foreground" role="status">
              {testState}
            </span>
          )}
          <ConfirmButton
            title="Delete this draft?"
            confirmLabel="Delete"
            action={remove}
            trigger={<Button variant="ghost" className="ml-auto" />}
          >
            Delete draft
          </ConfirmButton>
        </div>
      </div>

      <EmailPreview
        draft={draft}
        donorId={previewDonor}
        traits={previewTraits}
        locale={previewLocale}
        traitOptions={options.traits}
        onTraitsChange={(traits) => {
          setPreviewTraits(traits);
          setPreviewDonor(null);
        }}
        onLocaleChange={setPreviewLocale}
      />
    </div>
  );
}
