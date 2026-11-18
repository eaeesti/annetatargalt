"use client";

import { useId, useState } from "react";
import Markdown from "../Markdown";
import CharityPicker from "./CharityPicker";
import type { CharityPickerTexts } from "./CharityPicker";
import SplitBar from "./SplitBar";
import { splitColor } from "./split-colors";
import type Proportions from "@/utils/proportions";
import type { ProportionKey } from "@/utils/proportions";
import type { StrapiCause } from "@/types/generated/strapi";
import type { Locale } from "@/utils/locale";
import {
  SUPPORT_KEY,
  amountsByCause,
  supportShare,
} from "@/utils/donation-amounts";
import { classes } from "@/utils/react";
import { isStartingSplit, startingSplit, toggledShares } from "@/utils/split";

export interface CauseChooserTexts extends CharityPickerTexts {
  legend: string | null;
  hint: string | null;
  notChosen: string | null;
  /** "I want to specify": choosing charities, while it's the fund alone. */
  specifyCharities: string | null;
  /** "Edit": changing the charities chosen. */
  editCharities: string | null;
  /** "Support Anneta Targalt": the platform, a choice beside the causes. */
  support: string | null;
  /** Under it: why, in Markdown, with a link to more. */
  supportDescription: string | null;
  /** "Reset split": back to 5% for support, as "Split evenly" is without it. */
  resetSplit: string | null;
  splitHint: string | null;
}

interface CauseChooserProps {
  causes: { data: StrapiCause[] };
  /** The platform's organization, which support goes to; none, no support. */
  supportOrganization: string | null;
  proportions: Proportions;
  setProportions: (proportions: Proportions) => void;
  amount: number;
  money: (amount: number) => string;
  texts: CauseChooserTexts;
  locale: Locale;
}

const hasInternalId = <T extends { internalId: string | null }>(
  organization: T,
): organization is T & { internalId: string } =>
  organization.internalId !== null;

interface ChoiceCardProps {
  inputId: string;
  on: boolean;
  onToggle: () => void;
  /** Its colour in the split bar, for the checkbox and the share too. */
  colorIndex: number;
  title: string | null;
  /** Under the title: what the choice is, or the way to its charities. */
  below?: React.ReactNode;
  /** The id of what describes it, for the checkbox. */
  describedBy?: string;
  share: number;
  /** Under the share: its amount or "Not chosen"; none, when listed below. */
  amountText: string | null;
  /** Under it all: the charities chosen, each with its amount. */
  children?: React.ReactNode;
}

/**
 * One of the choices: a cause, or support for the platform. It's the same
 * height ticked and unticked, so the list doesn't move as the donor chooses.
 */
function ChoiceCard({
  inputId,
  on,
  onToggle,
  colorIndex,
  title,
  below,
  describedBy,
  share,
  amountText,
  children,
}: ChoiceCardProps) {
  const color = splitColor(colorIndex);

  return (
    <div
      className={classes(
        on
          ? "bg-primary-50 ring-2 ring-primary-600"
          : "bg-white ring-1 ring-slate-400",
        "rounded-xl ring-inset",
      )}
    >
      <div
        className={classes(
          children ? "pb-1.5" : "",
          "flex items-start gap-3 p-3.5 xs:px-4",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <label className="flex cursor-pointer items-start gap-3 self-stretch">
            <input
              id={inputId}
              type="checkbox"
              checked={on}
              onChange={onToggle}
              aria-describedby={describedBy}
              className={classes(
                color.text,
                "mt-0.5 h-5 w-5 flex-none cursor-pointer rounded-sm border-slate-400 checked:border-transparent focus:ring-primary-600",
              )}
            />
            <span className="min-w-0 flex-1 text-base leading-6 font-semibold text-slate-900">
              {title}
            </span>
          </label>
          {below}
        </div>
        {/* The checkbox's too: all of the card but its links ticks it. */}
        <label
          htmlFor={inputId}
          className="flex-none cursor-pointer self-center text-right whitespace-nowrap"
        >
          <span
            className={classes(
              on ? color.text : "text-slate-500",
              "block text-lg leading-6 font-bold",
            )}
          >
            {share}%
          </span>
          {amountText !== null && (
            <span className="block text-[13px] leading-[18px] text-slate-500">
              {amountText}
            </span>
          )}
        </label>
      </div>
      {children}
    </div>
  );
}

/**
 * Where the donation goes: the causes to tick, and support for the platform
 * beside them, split evenly between the ticked causes (5% to support) and
 * adjustable with a split bar; and each ticked cause's organizations, its
 * fund unless the donor picks others.
 */
export default function CauseChooser({
  causes,
  supportOrganization,
  proportions,
  setProportions,
  amount,
  money,
  texts,
  locale,
}: CauseChooserProps) {
  const [pickerCause, setPickerCause] = useState<number | null>(null);
  const idPrefix = useId();
  const chosen = proportions.chosenKeys();
  const amounts = amountsByCause(
    proportions,
    amount,
    causes,
    supportOrganization,
  );

  // Every choice in the split bar's order: the causes, then support.
  const choices = [
    ...causes.data.map((cause, index) => ({
      key: cause.id,
      label: cause.title ?? "",
      colorIndex: index,
    })),
    ...(supportOrganization
      ? [
          {
            key: SUPPORT_KEY,
            label: texts.support ?? "",
            colorIndex: causes.data.length,
          },
        ]
      : []),
  ];
  const chosenChoices = choices.filter(({ key }) => chosen.includes(key));
  const supportOn = chosen.includes(SUPPORT_KEY);

  // Every choice's share, in the bar's order, and support's place in it.
  const keys = choices.map(({ key }) => key);
  const shares = keys.map((key) => proportions.getProportion(key));
  const supportIndex = keys.indexOf(SUPPORT_KEY);
  // Ticking or unticking keeps a split the donor adjusted, in proportion:
  // only Reset split (or Split evenly) starts it over. See toggledShares.
  const toggle = (key: ProportionKey) =>
    setProportions(
      proportions.withShares(
        keys,
        toggledShares(shares, keys.indexOf(key), supportIndex),
      ),
    );
  const startOver = () =>
    proportions.withShares(
      keys,
      startingSplit(
        shares.map((share) => share > 0),
        supportIndex,
      ),
    );
  const atStart = isStartingSplit(shares, supportIndex);

  // Just the cause's fund, as it starts: nothing to list. (The fund is the
  // organization marked as one, or else the first.)
  const fundOnly = (cause: StrapiCause) => {
    const organizations = proportions.get(cause.id).proportions?.chosenKeys();
    const fund =
      cause.organizations.find((organization) => organization.fund) ??
      cause.organizations[0];
    return organizations?.length === 1 && organizations[0] === fund?.internalId;
  };

  const picked = causes.data.find((cause) => cause.id === pickerCause);
  const pickedProportions = picked && proportions.get(picked.id).proportions;
  const supportInputId = `${idPrefix}-support`;
  const supportDescriptionId = `${idPrefix}-support-description`;

  return (
    <fieldset className="mt-2 flex flex-col gap-3">
      <legend className="mb-1 text-xl leading-6 font-semibold tracking-tight text-primary-700">
        {texts.legend}
      </legend>
      {texts.hint && (
        // Markdown, for a link to more about the causes.
        <Markdown
          className="prose prose-sm mb-3 max-w-none text-slate-500 prose-primary [&_p]:my-0"
          newTabs="all"
        >
          {texts.hint}
        </Markdown>
      )}
      {amounts.causes.map(
        ({ cause, amount: causeAmount, organizations }, index) => {
          const on = chosen.includes(cause.id);
          const custom = on && !fundOnly(cause);
          const descriptionId = `${idPrefix}-cause-${cause.id}-description`;
          const pickerButton = (text: string | null, className: string) => (
            <button
              type="button"
              onClick={() => setPickerCause(cause.id)}
              aria-label={`${text ?? ""}: ${cause.title ?? ""}`}
              className={classes(
                "cursor-pointer py-2.5 text-[13px] leading-[18px] font-semibold text-primary-700 underline hover:opacity-70",
                className,
              )}
            >
              {text}
            </button>
          );
          return (
            <ChoiceCard
              key={cause.id}
              inputId={`${idPrefix}-cause-${cause.id}`}
              on={on}
              onToggle={() => toggle(cause.id)}
              colorIndex={index}
              title={cause.title}
              // The cause's short description while unticked, the button to
              // its charities once ticked, in one place: as tall as the
              // taller of the two either way, so ticking doesn't move a thing.
              below={
                !custom && (
                  <div className="grid self-stretch">
                    {cause.shortDescription && (
                      <p
                        id={descriptionId}
                        className={classes(
                          on ? "invisible" : "",
                          "col-start-1 row-start-1 mt-0.5 ml-8 text-[13px] leading-[18px] text-slate-500",
                        )}
                      >
                        {cause.shortDescription}
                      </p>
                    )}
                    {pickerButton(
                      texts.specifyCharities,
                      classes(
                        on ? "" : "invisible",
                        "col-start-1 row-start-1 -mt-1.5 -mb-2.5 ml-8 justify-self-start",
                      ),
                    )}
                  </div>
                )
              }
              describedBy={
                !custom && cause.shortDescription ? descriptionId : undefined
              }
              share={proportions.getProportion(cause.id)}
              // With charities chosen, their amounts are listed instead.
              amountText={
                custom ? null : on ? money(causeAmount) : texts.notChosen
              }
            >
              {custom && (
                <div className="flex flex-col gap-1 pr-3.5 pb-2.5 pl-[46px] xs:pr-4 xs:pl-12">
                  <ul className="flex flex-col gap-1 text-[13px] leading-[18px]">
                    {organizations.map(({ organization, amount: part }) => (
                      <li
                        key={organization.internalId}
                        className="flex justify-between gap-3"
                      >
                        <span className="min-w-0 font-medium text-slate-900">
                          {organization.title}
                        </span>
                        <span className="flex-none font-semibold whitespace-nowrap text-slate-700">
                          {money(part)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {pickerButton(texts.editCharities, "-mt-1 -mb-2 self-start")}
                </div>
              )}
            </ChoiceCard>
          );
        },
      )}
      {supportOrganization && (
        <ChoiceCard
          inputId={supportInputId}
          on={supportOn}
          onToggle={() => toggle(SUPPORT_KEY)}
          colorIndex={causes.data.length}
          title={texts.support}
          below={
            texts.supportDescription && (
              <div id={supportDescriptionId} className="mt-0.5 ml-8">
                {/* Markdown, for the link to more about the platform. */}
                <Markdown
                  className="prose prose-sm max-w-none text-[13px] leading-[18px] text-slate-500 prose-primary [&_p]:my-0"
                  newTabs="all"
                >
                  {texts.supportDescription}
                </Markdown>
              </div>
            )
          }
          describedBy={
            texts.supportDescription ? supportDescriptionId : undefined
          }
          share={supportShare(proportions)}
          amountText={supportOn ? money(amounts.support) : texts.notChosen}
        />
      )}
      {chosenChoices.length > 1 && (
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">
              {texts.adjustSplit}
            </span>
            {!atStart && (
              <button
                type="button"
                onClick={() => setProportions(startOver())}
                className="cursor-pointer py-1.5 text-sm font-semibold text-primary-700 underline hover:opacity-70"
              >
                {supportOn ? texts.resetSplit : texts.splitEvenly}
              </button>
            )}
          </div>
          <SplitBar
            parts={chosenChoices.map(({ key, label }) => ({
              label,
              share: proportions.getProportion(key),
            }))}
            colorIndexes={chosenChoices.map(({ colorIndex }) => colorIndex)}
            onChange={(shares) =>
              setProportions(
                proportions.withShares(
                  chosenChoices.map(({ key }) => key),
                  shares,
                ),
              )
            }
            locale={locale}
          />
          {texts.splitHint && (
            <p className="text-[13px] leading-[18px] text-slate-500">
              {texts.splitHint}
            </p>
          )}
        </div>
      )}
      {picked && pickedProportions && (
        <CharityPicker
          causeTitle={picked.title ?? ""}
          causeSlug={picked.slug}
          organizations={picked.organizations.filter(hasInternalId)}
          amount={
            amounts.causes.find(({ cause }) => cause.id === picked.id)
              ?.amount ?? 0
          }
          proportions={pickedProportions}
          onConfirm={(subs) => {
            setProportions(proportions.withSubProportions(picked.id, subs));
            setPickerCause(null);
          }}
          onClose={() => setPickerCause(null)}
          money={money}
          texts={texts}
          locale={locale}
        />
      )}
    </fieldset>
  );
}
