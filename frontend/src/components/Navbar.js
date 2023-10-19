"use client";

import { useState } from "react";
import { Dialog } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Anchor from "./elements/Anchor";
import Button from "./elements/Button";
import Image from "./elements/Image";

const navigation = [
  { name: "Product", href: "#" },
  { name: "Features", href: "#" },
  { name: "Marketplace", href: "#" },
  { name: "Company", href: "#" },
];

export default function Navbar({ global }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { title, navbar } = global;

  return (
    <>
      <nav className="flex sticky top-0 z-10 justify-center w-full bg-white shadow-md shadow-primary-700/10">
        <div className="flex gap-x-6 justify-between items-center px-6 py-4 w-full max-w-7xl lg:px-8">
          <div className="flex flex-grow lg:flex-grow-0">
            <Anchor
              href="/"
              className="p-1.5 -m-1.5 rounded-md hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <span className="sr-only">{title}</span>
              <Image className="w-auto h-8" data={navbar.logo} />
            </Anchor>
          </div>
          <div className="hidden gap-x-4 lg:flex">
            {navbar.links.map((link) => (
              <Button key={link.id} type="text" size="lg" {...link} />
            ))}
          </div>
          <div className="">
            <Button {...navbar.ctaButton} />
          </div>
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              className="inline-flex justify-center items-center p-2.5 -m-2.5 rounded-md text-slate-700"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">Open main menu</span>
              <Bars3Icon className="w-6 h-6" aria-hidden="true" />
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
        <Dialog.Panel className="overflow-y-auto fixed inset-y-0 right-0 z-10 px-6 py-4 w-full bg-white sm:max-w-sm sm:ring-1 sm:ring-slate-900/10">
          <div className="flex gap-x-6 items-center">
            <Anchor
              href="/"
              className="flex-grow p-1.5 -m-1.5 hover:opacity-80"
            >
              <span className="sr-only">{title}</span>
              <Image className="w-auto h-8 sm:hidden" data={navbar.logo} />
            </Anchor>
            <Button {...navbar.ctaButton} />
            <button
              type="button"
              className="p-2.5 -m-2.5 rounded-md text-slate-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
          <div className="flow-root mt-6">
            <div className="py-6 space-y-2">
              {navbar.links.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  className="block px-3 py-2 -mx-3 text-base font-semibold leading-7 rounded-lg text-slate-900 hover:bg-primary-100"
                >
                  {link.text}
                </a>
              ))}
            </div>
          </div>
        </Dialog.Panel>
      </Dialog>
    </>
  );
}
