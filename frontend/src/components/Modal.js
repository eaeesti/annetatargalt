import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { classes } from "@/utils/react";

const ModalIcon = ({ Icon, iconClass, backgroundClass }) => {
  return (
    <div
      className={classes(
        "mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full",
        backgroundClass,
      )}
    >
      <Icon className={classes("h-6 w-6", iconClass)} />
    </div>
  );
};

const icons = {
  success: (
    <ModalIcon
      Icon={CheckIcon}
      iconClass="text-green-600"
      backgroundClass="bg-green-100"
    />
  ),
  error: (
    <ModalIcon
      Icon={XMarkIcon}
      iconClass="text-red-600"
      backgroundClass="bg-red-100"
    />
  ),
  warning: (
    <ModalIcon
      Icon={ExclamationTriangleIcon}
      iconClass="text-yellow-600"
      backgroundClass="bg-yellow-100"
    />
  ),
  info: (
    <ModalIcon
      Icon={InformationCircleIcon}
      iconClass="text-primary-600"
      backgroundClass="bg-primary-100"
    />
  ),
};

const ModalButton = ({ text, type = "primary", onClick = () => {} }) => {
  const styles = {
    primary:
      "text-white bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600",
    secondary:
      "text-white text-primary-600 bg-primary-50 hover:bg-primary-100 focus-visible:outline-primary-100",
    danger:
      "text-white bg-red-600 hover:bg-red-500 focus-visible:outline-red-600",
  };
  return (
    <button
      type="button"
      className={classes(
        "inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        styles[type],
      )}
      onClick={onClick}
    >
      {text}
    </button>
  );
};

export default function Modal({ open, data, setOpen, closeText }) {
  const {
    title = "",
    description = "",
    icon = "success",
    buttons = [
      { text: closeText, onClick: () => setOpen(false), type: "primary" },
    ],
  } = data;

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-sm transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:p-6">
                <div>
                  {icons[icon]}
                  <div className="text-center">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      {title}
                    </Dialog.Title>
                    <div className="mt-2 space-y-2">
                      {description.split("\n").map((descriptionLine, index) => (
                        <p key={index} className="text-sm text-gray-500">
                          {descriptionLine}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:mt-6 sm:flex-row">
                  {buttons.map((props) => (
                    <ModalButton
                      key={props.text}
                      {...props}
                      onClick={() => {
                        if (props.onClick) props.onClick();
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
