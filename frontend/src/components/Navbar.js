"use client";

import { useState } from "react";
import { Dialog } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Anchor from "./elements/Anchor";
import Button from "./elements/Button";
import Image from "./elements/Image";

export default function Navbar({ global }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { title, navbar } = global;

  return (
    <>
      <nav className="sticky top-0 z-10 flex w-full justify-center bg-white shadow-md shadow-primary-600/10">
        <div className="flex w-full max-w-7xl items-center justify-between gap-x-6 px-6 py-4 lg:px-8">
          <div className="flex flex-grow lg:flex-grow-0">
            <Anchor
              href="/"
              className="-m-1.5 rounded-md p-1.5 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <span className="sr-only">{title}</span>
              <Image className="h-8 w-auto" data={navbar.logo} priority />
            </Anchor>
          </div>
          <div className="hidden gap-x-4 lg:flex">
            {navbar.links.map((link) => (
              <Button key={link.id} type="text" size="lg" {...link} />
            ))}
            <Button key='calculator' type="text" size="lg" href='/calculator' text='Kalkulators'/>
          </div>
          <div className="">
            <Button {...navbar.ctaButton} />
          </div>
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-slate-700"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">Open main menu</span>
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
        <Dialog.Panel className="fixed inset-y-0 right-0 z-20 w-full overflow-y-auto bg-white px-6 py-4 sm:max-w-sm sm:ring-1 sm:ring-slate-900/10">
          <div className="flex items-center gap-x-6">
            <Anchor
              href="/"
              className="-m-1.5 flex-grow p-1.5 hover:opacity-80"
            >
              <span className="sr-only">{title}</span>
              <Image
                className="h-8 w-auto sm:hidden"
                data={navbar.logo}
                priority
              />
            </Anchor>
            <Button {...navbar.ctaButton} />
            <button
              type="button"
              className="-m-2.5 rounded-md p-2.5 text-slate-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="space-y-2 py-6">
              {navbar.links.map((link) => (
                <Anchor
                  key={link.id}
                  href={link.href}
                  className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-slate-900 hover:bg-primary-100"
                >
                  {link.text}
                </Anchor>
              ))}
            </div>
          </div>
        </Dialog.Panel>
        {/* TODO new link to new page of calculater */}
      </Dialog>
    </>
  );
}
