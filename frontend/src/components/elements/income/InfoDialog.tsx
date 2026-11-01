import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import InfoIcon from "@/components/icons/InfoIcon";
import Markdown from "../Markdown";
import { classes } from "@/utils/react";

interface InfoDialogProps {
  /** The link that opens it. */
  linkText: string | null;
  title: string | null;
  text: string | null;
  closeText: string;
  className?: string;
}

/** A link with an info icon that opens a short explanation. */
export default function InfoDialog({
  linkText,
  title,
  text,
  closeText,
  className,
}: InfoDialogProps) {
  const [open, setOpen] = useState(false);
  if (!linkText || !text) return null;

  return (
    <>
      <button
        type="button"
        className={classes(
          "inline-flex cursor-pointer items-center gap-1.5 hover:opacity-70",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <InfoIcon className="h-5 w-5 shrink-0" aria-hidden />
        {linkText}
      </button>
      <Dialog open={open} onClose={setOpen} className="relative z-30">
        {/* Fades and rises in the way Modal's do. */}
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-slate-900/40 transition-opacity duration-300 ease-out data-closed:opacity-0 data-leave:duration-200 data-leave:ease-in"
        />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel
            transition
            className="relative w-full max-w-lg rounded-xl bg-white p-6 text-left shadow-xl transition-all duration-300 ease-out data-closed:translate-y-4 data-closed:opacity-0 data-leave:duration-200 data-leave:ease-in sm:p-8 sm:data-closed:translate-y-0 sm:data-closed:scale-95"
          >
            <button
              type="button"
              className="absolute top-4 right-4 cursor-pointer text-slate-400 hover:text-slate-600"
              onClick={() => setOpen(false)}
            >
              <span className="sr-only">{closeText}</span>
              <XMarkIcon className="h-6 w-6" aria-hidden />
            </button>
            {title && (
              <DialogTitle className="mb-4 pr-8 text-lg font-semibold text-slate-900">
                {title}
              </DialogTitle>
            )}
            <Markdown className="prose prose-sm prose-primary">{text}</Markdown>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
