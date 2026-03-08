import { classes } from "@/utils/react";
import Markdown from "../Markdown";

interface CheckboxInputProps {
  name: string;
  value: boolean;
  setValue: (value: boolean) => void;
  label: string;
  labelSize?: "base" | "sm";
}

export default function CheckboxInput({
  name,
  value,
  setValue,
  label,
  labelSize = "base",
}: CheckboxInputProps) {
  const proseClass = {
    base: "prose-base",
    sm: "prose-sm",
  }[labelSize];

  return (
    <div className="flex items-center gap-2">
      <input
        id={name}
        aria-describedby={`${name}-description`}
        name={name}
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary-600 focus:ring-primary-600"
        value={value as any}
        checked={value}
        onChange={(event) => setValue(event.target.checked)}
      />
      <label
        id={`${name}-description`}
        htmlFor={name}
        className="cursor-pointer"
      >
        <Markdown
          className={classes("prose prose-primary", proseClass)}
          newTabs="all"
        >
          {label}
        </Markdown>
      </label>
    </div>
  );
}
