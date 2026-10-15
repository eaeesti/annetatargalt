"use client";

import { EnvelopeIcon } from "@heroicons/react/24/outline";
import Markdown from "../elements/Markdown";
import { useState } from "react";
import Button from "../elements/Button";
import { describeErrorResponse, getStrapiURL } from "@/utils/strapi";
import Modal from "../Modal";
import type { ModalData } from "../Modal";
import type {
  StrapiContactSection,
  StrapiGlobal,
} from "@/types/generated/strapi";

interface ContactSectionProps extends StrapiContactSection {
  global: StrapiGlobal;
}

export default function ContactSection(props: ContactSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData>({});

  function showModal(data: ModalData) {
    setModalData(data);
    setModalOpen(true);
  }

  const [data, setData] = useState<Record<string, string>>({});

  const ready = data.name && data.email && data.message;

  function showError(description: string) {
    showModal({
      icon: "error",
      title: props.global.errorText ?? "",
      description,
    });
  }

  const submit = async () => {
    let response;
    try {
      response = await fetch(getStrapiURL("/api/contact"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      // Offline, or the request never got an answer.
      showError(String(error));
      return;
    }

    if (response.ok) {
      setData({});
      showModal({
        icon: "success",
        title: props.successTitle ?? "",
        description: props.successDescription ?? "",
      });
    } else {
      showError(await describeErrorResponse(response));
    }
  };

  return (
    <section className="grid w-full grow grid-cols-1 justify-center lg:grid-cols-2">
      <div className="bg-slate-100 px-6 pt-24 pb-20 sm:pt-32 lg:px-8 lg:py-48">
        <div className="mx-auto max-w-lg lg:mr-0">
          <h1 className="text-3xl font-bold tracking-tight text-primary-700">
            {props.title}
          </h1>
          <Markdown className="prose prose-lg mt-6 w-full text-slate-600 prose-primary">
            {props.description}
          </Markdown>
          <dl className="mt-10 space-y-4 text-base leading-7 text-slate-600">
            <div className="flex gap-x-4">
              <dt className="flex-none">
                <span className="sr-only">{props.emailLabel}</span>
                <EnvelopeIcon
                  className="h-7 w-6 text-slate-400"
                  aria-hidden="true"
                />
              </dt>
              <dd>{props.contactEmail}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="px-6 pt-12 pb-20 sm:pt-16 lg:px-8 lg:py-48">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="mx-auto w-full max-w-lg lg:ml-0"
        >
          <div className="mx-auto lg:mr-0">
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm leading-6 font-semibold text-slate-900"
                >
                  {props.nameLabel}
                </label>
                <div className="mt-2.5">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    autoComplete="name"
                    className="block w-full rounded-md border-0 px-3.5 py-2 text-slate-900 shadow-xs ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-primary-600 focus:ring-inset sm:text-sm sm:leading-6"
                    value={data.name || ""}
                    onChange={(event) =>
                      setData({ ...data, name: event.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm leading-6 font-semibold text-slate-900"
                >
                  {props.emailLabel}
                </label>
                <div className="mt-2.5">
                  <input
                    type="email"
                    name="email"
                    id="email"
                    autoComplete="email"
                    className="block w-full rounded-md border-0 px-3.5 py-2 text-slate-900 shadow-xs ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-primary-600 focus:ring-inset sm:text-sm sm:leading-6"
                    value={data.email || ""}
                    onChange={(event) =>
                      setData({ ...data, email: event.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm leading-6 font-semibold text-slate-900"
                >
                  {props.messageLabel}
                </label>
                <div className="mt-2.5">
                  <textarea
                    name="message"
                    id="message"
                    rows={4}
                    maxLength={1024}
                    className="block w-full rounded-md border-0 px-3.5 py-2 text-slate-900 shadow-xs ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-primary-600 focus:ring-inset sm:text-sm sm:leading-6"
                    value={data.message || ""}
                    onChange={(event) =>
                      setData({ ...data, message: event.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                text={props.sendLabel}
                type="primary"
                size="md"
                disabled={!ready}
                buttonType="submit"
              />
            </div>
          </div>
        </form>
      </div>
      <Modal
        open={modalOpen}
        data={modalData}
        setOpen={setModalOpen}
        closeText={props.global.closeText ?? ""}
      />
    </section>
  );
}
