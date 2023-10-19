import { classes } from "@/utils/react";
import { ArrowLongRightIcon } from "@heroicons/react/20/solid";
import Anchor from "./Anchor";

export default function Button({ text, type, arrow, link }) {
  const buttons = {
    primary:
      "px-4 py-2.5 text-white shadow-sm bg-primary-600 hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
    secondary:
      "px-4 py-2.5 text-primary-600 shadow-sm bg-primary-100 hover:bg-primary-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
    text: "px-1 py-0.5 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
  };

  const className = classes(
    "flex gap-1.5 hover:gap-2.5 duration-100 transition-[gap] items-center text-sm font-semibold rounded-md",
    buttons[type]
  );

  return (
    <Anchor href={link.href} newTab={link.newTab} className={className}>
      {text}
      {arrow && <ArrowLongRightIcon className="w-5 h-5" />}
    </Anchor>
  );
}
