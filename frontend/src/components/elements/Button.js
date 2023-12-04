"use client";
import { classes } from "@/utils/react";
import { ArrowLongRightIcon } from "@heroicons/react/20/solid";
import Anchor from "./Anchor";
import { usePlausible } from "next-plausible";

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
  ...rest
}) {
  const plausible = usePlausible();

  const buttons = {
    primary:
      "text-white shadow-sm bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 disabled:hover:bg-primary-600",
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
  };

  const fullClassName = classes(
    "flex gap-1.5 items-center justify-center font-semibold rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 text-center disabled:opacity-50 disabled:cursor-not-allowed",
    sizes[size],
    buttons[type],
    className,
  );

  if (href) {
    return (
      <Anchor
        href={href}
        newTab={newTab}
        className={fullClassName}
        onClick={() => {
          if (plausibleEvent) {
            plausible(plausibleEvent);
          }
        }}
        {...rest}
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
        onClick(event);
      }}
      className={fullClassName}
      {...rest}
    >
      {text}
      {children}
      {arrow && <ArrowLongRightIcon className="h-5 w-5" />}
    </button>
  );
}
