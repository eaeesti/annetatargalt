"use client";

import { useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import Button from "../elements/Button";
import Markdown from "../elements/Markdown";
import LoadingSection from "./LoadingSection";
import {
  describeErrorResponse,
  getStrapiURL,
  readStrapiJson,
} from "@/utils/strapi";
import {
  currentToken,
  keepToken,
  type TokenPlace,
} from "@/utils/email-settings-token";
import { isLocale, type Locale } from "@/utils/locale";
import { escapeMarkdown, format } from "@/utils/string";
import type {
  StrapiEmailPreferencesSection,
  StrapiGlobal,
} from "@/types/generated/strapi";

interface Preferences {
  email: string | null;
  newsletter: boolean;
  transferEmails: boolean;
  yearlyEmails: boolean;
  /** The language chosen for the emails; null for the one last given in. */
  emailLocale: Locale | null;
}

type Choice = "newsletter" | "transferEmails" | "yearlyEmails";

/** Each language by its name in itself, as language choices are shown. */
const LANGUAGES: { locale: Locale; name: string }[] = [
  { locale: "et", name: "Eesti" },
  { locale: "en", name: "English" },
];

interface EmailPreferencesSectionProps extends StrapiEmailPreferencesSection {
  global: StrapiGlobal;
}

function browser(): TokenPlace {
  return {
    location: window.location,
    history: window.history,
    storage: () => window.sessionStorage,
  };
}

/** Moves a link's token out of the address, now and for a link followed later. */
function subscribeToToken(onChange: () => void) {
  function kept() {
    keepToken(browser());
    onChange();
  }
  kept();
  window.addEventListener("hashchange", kept);
  return () => window.removeEventListener("hashchange", kept);
}

/**
 * The donor's token, from the link in their email (see email-settings-token).
 * Undefined until the page runs in the browser, which is the only place that
 * has it.
 */
function useToken(): string | null | undefined {
  return useSyncExternalStore(
    subscribeToToken,
    () => currentToken(browser()),
    () => undefined,
  );
}

/**
 * A donor's choices, asked for with the token in the body, not the URL. Null
 * for a link that isn't one of ours; anything else that goes wrong is thrown,
 * to be shown as an error and tried again.
 */
async function findPreferences(token: string): Promise<Preferences | null> {
  const response = await fetch(getStrapiURL("/api/email-preferences/find"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await describeErrorResponse(response));
  const found = await readStrapiJson<Partial<Preferences>>(response);
  return isPreferences(found)
    ? {
        ...found,
        emailLocale: isLocale(found.emailLocale) ? found.emailLocale : null,
      }
    : null;
}

/**
 * Which emails a donor gets, besides the confirmations of their donations.
 * The link in each email has a token for the donor, and that's all there is
 * to say who they are.
 */
export default function EmailPreferencesSection({
  global,
  invalidLinkTitle,
  invalidLinkText,
  ...section
}: EmailPreferencesSectionProps) {
  const token = useToken();
  // SWR tries again after an error by itself, so the form appears once the
  // backend answers.
  const { data, error, isLoading } = useSWR<
    Preferences | null,
    Error,
    [string, string] | null
  >(token ? ["email-preferences", token] : null, ([, token]) =>
    findPreferences(token),
  );

  if (token === undefined || isLoading) return <LoadingSection />;

  return (
    <section className="flex grow justify-center bg-slate-100 px-4 py-20 sm:py-28">
      <div className="flex w-full max-w-xl flex-col gap-8">
        {token && data ? (
          <PreferencesForm
            {...section}
            global={global}
            token={token}
            initial={data}
          />
        ) : token && error ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-balance text-primary-700 sm:text-4xl">
              {global.errorText}
            </h1>
            <p className="text-lg text-slate-700">{error.message}</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-balance text-primary-700 sm:text-4xl">
              {invalidLinkTitle}
            </h1>
            <Markdown className="prose prose-lg prose-primary">
              {invalidLinkText}
            </Markdown>
          </>
        )}
      </div>
    </section>
  );
}

function isPreferences(
  data: Partial<Preferences>,
): data is Omit<Preferences, "emailLocale"> & Partial<Preferences> {
  return (
    typeof data.newsletter === "boolean" &&
    typeof data.transferEmails === "boolean" &&
    typeof data.yearlyEmails === "boolean"
  );
}

interface PreferencesFormProps extends Omit<
  EmailPreferencesSectionProps,
  "invalidLinkTitle" | "invalidLinkText"
> {
  token: string;
  initial: Preferences;
}

function PreferencesForm({
  token,
  initial,
  global,
  title,
  text,
  newsletterLabel,
  newsletterDescription,
  transferEmailsLabel,
  transferEmailsDescription,
  yearlyEmailsLabel,
  yearlyEmailsDescription,
  languageLabel,
  languageDescription,
  automaticLanguageText,
  saveText,
  savedText,
}: PreferencesFormProps) {
  const [preferences, setPreferences] = useState(initial);
  // What was saved last, to begin with what was loaded. Only what's changed
  // from it is sent: changing one email isn't a choice about the others.
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const choices: {
    name: Choice;
    label: string | null;
    description: string | null;
  }[] = [
    {
      name: "newsletter",
      label: newsletterLabel,
      description: newsletterDescription,
    },
    {
      name: "transferEmails",
      label: transferEmailsLabel,
      description: transferEmailsDescription,
    },
    {
      name: "yearlyEmails",
      label: yearlyEmailsLabel,
      description: yearlyEmailsDescription,
    },
  ];

  // The choices can't change while they're being saved, so the reply is
  // about what's on the page.
  const saving = status === "saving";

  async function save() {
    const sent = preferences;
    const changes: Partial<Record<Choice, boolean>> & {
      emailLocale?: Locale | null;
    } = {};
    for (const { name } of choices) {
      if (sent[name] !== saved[name]) changes[name] = sent[name];
    }
    if (sent.emailLocale !== saved.emailLocale) {
      changes.emailLocale = sent.emailLocale;
    }
    setError(null);
    if (Object.keys(changes).length === 0) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    try {
      const response = await fetch(getStrapiURL("/api/email-preferences"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...changes }),
      });
      if (!response.ok) {
        setError(await describeErrorResponse(response));
        setStatus("idle");
        return;
      }
      setSaved(sent);
      setStatus("saved");
    } catch (caught) {
      // Offline, or the request never got an answer.
      setError(String(caught));
      setStatus("idle");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-balance text-primary-700 sm:text-4xl">
          {title}
        </h1>
        <Markdown className="prose prose-lg prose-primary">
          {format(text ?? "", {
            email: escapeMarkdown(preferences.email ?? ""),
          })}
        </Markdown>
      </div>
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <fieldset className="flex flex-col divide-y divide-slate-200 rounded-xl bg-white shadow-xs ring-1 ring-slate-900/5">
          {choices.map(({ name, label, description }) => (
            <label
              key={name}
              className="flex cursor-pointer items-start gap-4 px-5 py-4 has-disabled:cursor-wait sm:px-6"
            >
              <input
                type="checkbox"
                name={name}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded-sm border-slate-300 text-primary-600 checked:border-transparent focus:ring-primary-600 disabled:cursor-wait"
                checked={preferences[name]}
                disabled={saving}
                onChange={(event) => {
                  setPreferences({
                    ...preferences,
                    [name]: event.target.checked,
                  });
                  setStatus("idle");
                }}
              />
              <span className="flex flex-col gap-1">
                <span className="font-semibold text-slate-900">{label}</span>
                {description && (
                  <span className="text-sm text-slate-600">{description}</span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
        {/* Shown once Strapi has its texts */}
        {languageLabel && automaticLanguageText && (
          <div
            role="radiogroup"
            aria-labelledby="email-locale-label"
            aria-describedby={
              languageDescription ? "email-locale-description" : undefined
            }
            className="flex flex-col gap-3 rounded-xl bg-white px-5 py-4 shadow-xs ring-1 ring-slate-900/5 sm:px-6"
          >
            <div className="flex flex-col gap-1">
              <span
                id="email-locale-label"
                className="font-semibold text-slate-900"
              >
                {languageLabel}
              </span>
              {languageDescription && (
                <span
                  id="email-locale-description"
                  className="text-sm text-slate-600"
                >
                  {languageDescription}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { locale: null, name: automaticLanguageText },
                ...LANGUAGES,
              ].map(({ locale, name }) => (
                <label
                  key={locale ?? "automatic"}
                  className="flex cursor-pointer items-center gap-2 text-slate-900 has-disabled:cursor-wait"
                >
                  <input
                    type="radio"
                    name="emailLocale"
                    value={locale ?? ""}
                    className="h-4 w-4 cursor-pointer border-slate-300 text-primary-600 focus:ring-primary-600 disabled:cursor-wait"
                    checked={preferences.emailLocale === locale}
                    disabled={saving}
                    onChange={() => {
                      setPreferences({ ...preferences, emailLocale: locale });
                      setStatus("idle");
                    }}
                  />
                  <span lang={locale ?? undefined}>{name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {status === "saved" && (
            <span
              className="flex animate-fade-in items-center gap-1.5 text-sm font-semibold text-primary-700"
              role="status"
            >
              <CheckCircleIcon className="h-5 w-5" aria-hidden />
              {savedText}
            </span>
          )}
          <Button
            text={saveText}
            type="primary"
            size="lg"
            buttonType="submit"
            disabled={saving}
          />
        </div>
        {error && (
          <p className="text-right text-sm text-red-700" role="alert">
            {global.errorText} {error}
          </p>
        )}
      </form>
    </>
  );
}
