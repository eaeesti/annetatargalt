"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import Anchor from "./Anchor";
import { keepScrollFor } from "@/utils/language-scroll";
import type { LanguageLink, Locale } from "@/utils/locale";
import { classes } from "@/utils/react";
import { uiText } from "@/utils/ui-text";

interface LanguageMenuProps {
  locale: Locale;
  languages: LanguageLink[];
  /** The language's name on the button, where there's room, not its code. */
  showName?: boolean;
  /** Where the menu opens: upwards at the bottom of the page. */
  anchor?: "bottom end" | "bottom start" | "top start";
  className?: string;
}

/** The choice of language: the current one, opening a menu of all. */
export default function LanguageMenu({
  locale,
  languages,
  showName = false,
  anchor = "bottom end",
  className,
}: LanguageMenuProps) {
  const current = languages.find((language) => language.locale === locale);

  return (
    <Menu>
      <MenuButton
        className={classes(
          "flex items-center gap-1.5 rounded-md font-semibold hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 focus-visible:outline-solid",
          className,
        )}
      >
        <GlobeAltIcon className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">
          {uiText(locale).language}: {current?.name}
        </span>
        <span className={showName ? "" : "uppercase"} aria-hidden="true">
          {showName ? current?.name : locale}
        </span>
        <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
      </MenuButton>
      <MenuItems
        anchor={anchor}
        className="z-30 min-w-40 rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-slate-900/10 [--anchor-gap:0.25rem] focus:outline-none"
      >
        {languages.map((language) => (
          <MenuItem key={language.locale}>
            <Anchor
              href={language.href}
              hrefLang={language.locale}
              lang={language.locale}
              aria-current={language.locale === locale ? "true" : undefined}
              onClick={() => {
                if (language.locale !== locale) keepScrollFor(language.href);
              }}
              className="flex items-center justify-between gap-4 px-4 py-2 text-slate-700 aria-[current]:font-semibold data-focus:bg-primary-100"
            >
              {language.name}
              {language.locale === locale && (
                <CheckIcon
                  className="h-5 w-5 text-primary-600"
                  aria-hidden="true"
                />
              )}
            </Anchor>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
