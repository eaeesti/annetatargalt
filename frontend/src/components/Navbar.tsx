"use client";

import { useState } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Anchor from "./elements/Anchor";
import Button from "./elements/Button";
import Image from "./elements/Image";
import LanguageMenu from "./elements/LanguageMenu";
import type { StrapiGlobal } from "@/types/generated/strapi";
import { localeOf, pagePath } from "@/utils/locale";
import type { LanguageLink } from "@/utils/locale";
import { uiText } from "@/utils/ui-text";

interface NavbarProps {
  global: StrapiGlobal;
  /** The languages to choose between; no choice is shown without them. */
  languages?: LanguageLink[];
}

export default function Navbar({ global, languages = [] }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { title, navbar } = global;
  const locale = localeOf(global);
  const home = pagePath("/", locale);

  if (!navbar) return;

  return (
    <>
      <nav className="sticky top-0 z-10 flex w-full justify-center bg-white shadow-md shadow-primary-600/10">
        <div className="flex w-full max-w-7xl items-center justify-between gap-x-6 px-6 py-4 lg:px-8">
          <div className="flex grow lg:grow-0">
            <Anchor
              href={home}
              className="-m-1.5 rounded-md p-1.5 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 focus-visible:outline-solid"
            >
              <span className="sr-only">{title}</span>
              <Image
                className="h-8 w-auto"
                data={navbar.logo}
                loading="eager"
              />
            </Anchor>
          </div>
          <div className="hidden gap-x-4 lg:flex">
            {navbar.links.map((link) => (
              <Button
                key={link.id}
                type="text"
                size="lg"
                text={link.text}
                href={link.href}
                newTab={link.newTab}
              />
            ))}
          </div>
          <div className="flex items-center gap-x-2">
            {languages.length > 0 && (
              <div className="hidden lg:block">
                <LanguageMenu
                  locale={locale}
                  languages={languages}
                  className="px-4 py-2.5 text-slate-500"
                />
              </div>
            )}
            {navbar.ctaButton && (
              <Button
                text={navbar.ctaButton.text}
                type={navbar.ctaButton.type}
                size={navbar.ctaButton.size}
                href={navbar.ctaButton.href}
                arrow={navbar.ctaButton.arrow}
                newTab={navbar.ctaButton.newTab}
                analyticsId={navbar.ctaButton.plausibleEvent}
              />
            )}
          </div>
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-slate-700"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">{uiText(locale).openMenu}</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>
      <Dialog
        as="div"
        className="lg:hidden"
        open={mobileMenuOpen}
        onClose={setMobileMenuOpen}
      >
        <div className="fixed inset-0 z-10" />
        <DialogPanel className="fixed inset-y-0 right-0 z-20 w-full overflow-y-auto bg-white px-6 py-4 sm:max-w-sm sm:ring-1 sm:ring-slate-900/10">
          <div className="flex items-center gap-x-6">
            <Anchor href={home} className="-m-1.5 grow p-1.5 hover:opacity-80">
              <span className="sr-only">{title}</span>
              <Image className="h-8 w-auto sm:hidden" data={navbar.logo} />
            </Anchor>
            {navbar.ctaButton && (
              <Button
                text={navbar.ctaButton.text}
                type={navbar.ctaButton.type}
                size={navbar.ctaButton.size}
                href={navbar.ctaButton.href}
                arrow={navbar.ctaButton.arrow}
                newTab={navbar.ctaButton.newTab}
                analyticsId={navbar.ctaButton.plausibleEvent}
              />
            )}
            <button
              type="button"
              className="-m-2.5 rounded-md p-2.5 text-slate-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="sr-only">{uiText(locale).closeMenu}</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="space-y-2 py-6">
              {navbar.links.map((link) => (
                <Anchor
                  key={link.id}
                  href={link.href ?? "/"}
                  className="-mx-3 block rounded-lg px-3 py-2 text-base leading-7 font-semibold text-slate-900 hover:bg-primary-100"
                >
                  {link.text}
                </Anchor>
              ))}
              {languages.length > 0 && (
                <LanguageMenu
                  locale={locale}
                  languages={languages}
                  showName
                  anchor="bottom start"
                  className="-mx-3 px-3 py-2 text-base leading-7 text-slate-500"
                />
              )}
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </>
  );
}
