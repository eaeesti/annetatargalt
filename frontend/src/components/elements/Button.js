import { classes } from "@/utils/react";
import { ArrowLongRightIcon } from "@heroicons/react/20/solid";
import Anchor from "./Anchor";

export default function Button({
  text,
  type,
  size = "md",
  href,
  arrow = false,
  newTab = false,
  className = "",
  children,
}) {
  const buttons = {
    primary:
      "text-white shadow-sm bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600",
    secondary:
      "text-primary-600 shadow-sm bg-primary-100 hover:bg-primary-200 focus-visible:outline-primary-600",
    white:
      "text-primary-700 shadow-sm bg-white hover:bg-primary-100 focus-visible:outline-white",
    text: "hover:opacity-70 focus-visible:outline-primary-600",
  };

  const sizes = {
    sm: "px-1 py-0.5",
    md: "px-3 py-2",
    lg: "px-4 py-2.5",
  };

  const fullClassName = classes(
    "flex gap-1.5 items-center justify-center font-semibold rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    sizes[size],
    buttons[type],
    className
  );

  return (
    <Anchor href={href} newTab={newTab} className={fullClassName}>
      {text}
      {children}
      {arrow && <ArrowLongRightIcon className="w-5 h-5" />}
    </Anchor>
  );
}
