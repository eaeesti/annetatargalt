"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { CONNECTION_FAILED } from "../lib/failure-message";

/**
 * A button for removing something, which asks first in a dialog: `title` is
 * the question, `description` what else goes with it, and `confirmLabel` the
 * button that does it. `action` gives back an error message, or null when it
 * worked; on an error the dialog stays open and says so.
 */
export function ConfirmButton({
  action,
  title,
  description,
  confirmLabel,
  trigger,
  children,
}: {
  action: () => Promise<string | null>;
  title: string;
  description?: string;
  confirmLabel: string;
  /** The button that opens the dialog, e.g. `<button className="…" />`. */
  trigger: React.ReactElement;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <AlertDialogTrigger render={trigger}>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const failed = await action();
                  if (failed) setError(failed);
                  else setOpen(false);
                } catch {
                  setError(CONNECTION_FAILED);
                }
              })
            }
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
