"use client";

import { Disclosure } from "@headlessui/react";
import { MinusSmallIcon, PlusSmallIcon } from "@heroicons/react/24/outline";
import Markdown from "../elements/Markdown";
import { GCEvent } from "next-goatcounter";

export default function FAQSection({ questions }) {
  return (
    <section className="flex-grow bg-white px-4 lg:px-8">
      <div className="container mx-auto py-8 sm:py-16 lg:max-w-3xl">
        <dl className="divide-y divide-slate-200">
          {questions.map((question) => (
            <Disclosure as="div" key={question.id} className="py-6">
              {({ open }) => (
                <>
                  <dt>
                    <Disclosure.Button
                      className="flex w-full items-center justify-between text-left text-slate-800 hover:opacity-70"
                      onClick={() => {
                        if (question.plausibleEvent && !open) {
                          GCEvent(question.plausibleEvent);
                        }
                      }}
                    >
                      <h2 className="text-lg font-semibold leading-7">
                        {question.question}
                      </h2>
                      <span className="ml-4 flex h-7 items-center">
                        {open ? (
                          <MinusSmallIcon
                            className="h-6 w-6"
                            aria-hidden="true"
                          />
                        ) : (
                          <PlusSmallIcon
                            className="h-6 w-6"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </Disclosure.Button>
                  </dt>
                  <Disclosure.Panel as="dd" className="mt-6 pr-12">
                    <Markdown className="prose prose-primary w-full">
                      {question.answer}
                    </Markdown>
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>
          ))}
        </dl>
      </div>
    </section>
  );
}
