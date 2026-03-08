"use client";

import { classes } from "@/utils/react";
import { ArrowLongRightIcon } from "@heroicons/react/20/solid";
import Anchor from "./Anchor";
import { usePlausible } from "next-plausible";

export interface ButtonProps {
  text?: string | null;
  type?: "primary" | "secondary" | "white" | "text" | null;
  size?: "link" | "sm" | "md" | "lg" | "xl" | "text" | null;
  href?: string | null;
  onClick?: (event?: React.MouseEvent) => void;
  arrow?: boolean | null;
  newTab?: boolean | null;
  className?: string;
  children?: React.ReactNode;
  buttonType?: "button" | "submit" | "reset";
  plausibleEvent?: string | null;
  disabled?: boolean;
  noIcon?: boolean;
  title?: string | null;
}

export default function Button({
  text,
  type,
  size = "md",
  href,
  onClick,
  arrow = false,
  newTab = false,
  className = "",
  children,
  buttonType = "button",
  plausibleEvent,
  disabled,
  noIcon,
  title,
}: ButtonProps) {
  const plausible = usePlausible();

  const buttons = {
    primary:
      "text-white shadow-sm bg-primary-700 hover:bg-primary-600 focus-visible:outline-primary-700 disabled:hover:bg-primary-600",
    secondary:
      "text-primary-600 shadow-sm bg-primary-100 hover:bg-primary-200 focus-visible:outline-primary-600 disabled:hover:bg-primary-100",
    white:
      "text-primary-800 shadow-sm bg-white hover:bg-primary-100 focus-visible:outline-white disabled:hover:bg-white",
    text: "hover:opacity-70 focus-visible:outline-primary-600 disabled:hover:opacity-70",
  };

  const sizes = {
    link: "px-0 py-0",
    sm: "px-1 py-0.5",
    md: "px-3 py-2",
    lg: "px-4 py-2.5",
    xl: "px-8 py-4 text-xl",
  };

  const effectiveSize = size === "text" ? "link" : (size ?? "md");
  const fullClassName = classes(
    "flex gap-1.5 items-center justify-center font-semibold rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 text-center disabled:opacity-50 disabled:cursor-not-allowed",
    sizes[effectiveSize],
    type ? buttons[type] : undefined,
    className,
  );

  if (href) {
    return (
      <Anchor
        href={href}
        newTab={newTab ?? false}
        noIcon={noIcon}
        title={title ?? undefined}
        className={fullClassName}
        onClick={(event) => {
          if (plausibleEvent) {
            plausible(plausibleEvent);
          }
          if (onClick) {
            onClick();
            event.preventDefault();
          }
        }}
      >
        {text}
        {children}
        {arrow && <ArrowLongRightIcon className="h-5 w-5" />}
      </Anchor>
    );
  }

  return (
    <button
      type={buttonType}
      onClick={(event) => {
        if (plausibleEvent) plausible(plausibleEvent);
        if (onClick) onClick(event);
      }}
      className={fullClassName}
      disabled={disabled}
    >
      {text}
      {children}
      {arrow && <ArrowLongRightIcon className="h-5 w-5" />}
    </button>
  );
}
