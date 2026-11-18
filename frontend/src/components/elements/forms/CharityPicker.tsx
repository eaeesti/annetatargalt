"use client";

import { useId, useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Anchor from "../Anchor";
import Button from "../Button";
import SplitBar from "./SplitBar";
import { splitColor } from "./split-colors";
import type Proportions from "@/utils/proportions";
import type { StrapiOrganization } from "@/types/generated/strapi";
import { pagePath } from "@/utils/locale";
import type { Locale } from "@/utils/locale";
import { classes } from "@/utils/react";
import { isEven, toggledShares } from "@/utils/split";
import { format, plainText } from "@/utils/string";
import { uiText } from "@/utils/ui-text";

export interface CharityPickerTexts {
  /** "Charities for <%= cause %>" */
  title: string | null;
  /** "… Your <%= amount %> for this cause is split equally between them …" */
  text: string | null;
  chooseCharity: string | null;
  adjustSplit: string | null;
  splitEvenly: string | null;
  confirm: string | null;
  cancel: string | null;
  close: string | null;
  /** "Learn more": the link to an organization's page. */
  learnMore: string | null;
  /** "Recommended": after the cause's fund's name. */
  recommended: string | null;
}

interface CharityPickerProps {
  causeTitle: string;
  /** For the links to the organizations' pages, which are under the cause's. */
  causeSlug: string | null;
  organizations: (StrapiOrganization & { internalId: string })[];
  /** The cause's part of the donation, for the amounts shown. */
  amount: number;
  /** The cause's split between its organizations, as it is now. */
  proportions: Proportions;
  onConfirm: (proportions: Proportions) => void;
  onClose: () => void;
  money: (amount: number) => string;
  texts: CharityPickerTexts;
  locale: Locale;
}

/**
 * A cause's organizations to choose from, each split evenly when ticked and
 * adjustable with a split bar. Nothing changes until Confirm; Cancel or the
 * close button leaves the cause as it was. Mounted only while open, so it
 * starts from the cause's split each time.
 */
export default function CharityPicker({
  causeTitle,
  causeSlug,
  organizations,
  amount,
  proportions,
  onConfirm,
  onClose,
  money,
  texts,
  locale,
}: CharityPickerProps) {
  const [draft, setDraft] = useState(proportions);
  // The cause's fund, recommended: the organization marked as one, or else
  // the first, as the cause's own split starts.
  const recommendedId = (
    organizations.find((organization) => organization.fund) ?? organizations[0]
  )?.internalId;
  const idPrefix = useId();
  const chosen = draft.chosenKeys();
  const chosenIndexes = organizations
    .map((organization, index) => ({ organization, index }))
    .filter(({ organization }) => chosen.includes(organization.internalId));

  // Ticking or unticking keeps a split the donor adjusted, in proportion:
  // only Split evenly starts it over. See toggledShares.
  const toggle = (internalId: string) => {
    const keys = draft.keys();
    setDraft(
      draft.withShares(
        keys,
        toggledShares(
          keys.map((key) => draft.getProportion(key)),
          keys.indexOf(internalId),
          -1,
        ),
      ),
    );
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-slate-900/55" />
      <div className="fixed inset-0 flex w-screen items-center justify-center overflow-y-auto p-3 xs:p-4">
        <DialogPanel className="my-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl leading-7 font-bold tracking-tight text-primary-700">
              {format(texts.title ?? "", { cause: causeTitle })}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label={texts.close ?? undefined}
              className="-m-2.5 flex-none cursor-pointer rounded-lg p-2.5 text-slate-600 hover:opacity-70"
            >
              <XMarkIcon className="h-6 w-6" aria-hidden={true} />
            </button>
          </div>
          {texts.text && (
            <p className="text-sm text-slate-600">
              {format(texts.text, { amount: money(amount) })}
            </p>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">
              {format(texts.title ?? "", { cause: causeTitle })}
            </legend>
            {organizations.map((organization, index) => {
              const on = chosen.includes(organization.internalId);
              const share = draft.getProportion(organization.internalId);
              const color = splitColor(index);
              const id = `${idPrefix}-${organization.internalId}`;
              const page =
                causeSlug && organization.slug
                  ? pagePath(`${causeSlug}/${organization.slug}`, locale)
                  : null;
              // A line on what it does: its own short one, or the start of its
              // introduction.
              const description =
                organization.shortDescription ||
                (organization.introduction
                  ? plainText(organization.introduction)
                  : "");
              // Named by the name alone; its description and share describe it.
              const describedBy = [
                description ? `${id}-intro` : "",
                on ? `${id}-share` : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={organization.internalId}
                  className={classes(
                    on
                      ? "bg-primary-50 ring-2 ring-primary-600"
                      : "bg-white ring-1 ring-slate-300",
                    "flex items-start gap-3 rounded-lg p-3 ring-inset",
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(organization.internalId)}
                    aria-labelledby={`${id}-name`}
                    aria-describedby={describedBy || undefined}
                    className={classes(
                      color.text,
                      "mt-0.5 h-4.5 w-4.5 flex-none cursor-pointer rounded-sm border-slate-300 checked:border-transparent focus:ring-primary-600",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    {/* The name and the description are labels; the link to
                        the organization's page under them isn't, so
                        following it doesn't tick the box. */}
                    <label
                      htmlFor={id}
                      id={`${id}-name`}
                      className="block cursor-pointer text-[15px] leading-5 font-semibold text-slate-900"
                    >
                      {organization.title}
                      {organization.internalId === recommendedId &&
                        texts.recommended && (
                          <span className="font-normal opacity-50">
                            {` (${texts.recommended})`}
                          </span>
                        )}
                    </label>
                    {description && (
                      <label
                        htmlFor={id}
                        id={`${id}-intro`}
                        className="mt-0.5 line-clamp-2 cursor-pointer text-[13px] leading-[18px] text-slate-500"
                      >
                        {description}
                      </label>
                    )}
                    {page && (
                      <Anchor
                        href={page}
                        newTab={true}
                        className="inline-block py-1.5 text-[13px] leading-[18px] font-semibold text-primary-700 underline hover:opacity-70"
                      >
                        {texts.learnMore}
                        <span className="sr-only">
                          {`: ${organization.title ?? ""} (${uiText(locale).opensInNewTab})`}
                        </span>
                      </Anchor>
                    )}
                  </div>
                  {on && (
                    <label
                      htmlFor={id}
                      id={`${id}-share`}
                      className="flex-none cursor-pointer self-center text-right whitespace-nowrap"
                    >
                      <span
                        className={classes(
                          color.text,
                          "block text-[15px] leading-5 font-bold",
                        )}
                      >
                        {share}%
                      </span>
                      <span className="block text-[13px] leading-[18px] text-slate-500">
                        {money((amount * share) / 100)}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
          </fieldset>
          {chosenIndexes.length > 1 && (
            <div className="flex flex-col gap-1">
              <div className="flex min-h-8 items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">
                  {texts.adjustSplit}
                </span>
                {!isEven(
                  chosenIndexes.map(({ organization }) =>
                    draft.getProportion(organization.internalId),
                  ),
                ) && (
                  <button
                    type="button"
                    onClick={() => setDraft(draft.withEvenSplit(chosen))}
                    className="cursor-pointer py-1.5 text-sm font-semibold text-primary-700 underline hover:opacity-70"
                  >
                    {texts.splitEvenly}
                  </button>
                )}
              </div>
              <SplitBar
                parts={chosenIndexes.map(({ organization }) => ({
                  label: organization.title ?? "",
                  share: draft.getProportion(organization.internalId),
                }))}
                colorIndexes={chosenIndexes.map(({ index }) => index)}
                onChange={(shares) =>
                  setDraft(
                    draft.withShares(
                      chosenIndexes.map(
                        ({ organization }) => organization.internalId,
                      ),
                      shares,
                    ),
                  )
                }
                locale={locale}
              />
            </div>
          )}
          {chosen.length === 0 && (
            <p className="text-sm text-red-700">{texts.chooseCharity}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              text={texts.cancel}
              type="secondary"
              size="lg"
              onClick={onClose}
              buttonType="button"
              className="flex-1 basis-28"
            />
            <Button
              text={texts.confirm}
              type="primary"
              size="lg"
              onClick={() => onConfirm(draft)}
              disabled={chosen.length === 0}
              buttonType="button"
              className="flex-1 basis-40"
            />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
