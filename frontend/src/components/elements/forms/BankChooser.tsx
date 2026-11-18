import { classes } from "@/utils/react";
import { Label, Radio, RadioGroup } from "@headlessui/react";
import Image from "../Image";
import type { StrapiBankIcon } from "@/types/generated/strapi";

interface BankChooserOptionProps {
  value: string;
  label: string | null;
  icon?: StrapiBankIcon["icon"];
}

function BankChooserOption({ value, label, icon }: BankChooserOptionProps) {
  return (
    <Radio
      value={value}
      className={({ focus, checked }) =>
        classes(
          checked
            ? "border-primary-600 bg-primary-50 ring-1 ring-primary-600 ring-inset"
            : "border-slate-400",
          focus ? "bg-primary-50" : "",
          "relative flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-slate-900 shadow-xs focus:outline-hidden",
        )
      }
    >
      {({ checked }) => (
        <>
          {/* A radio button's look, as the donation type's: the option
              itself is the radio for screen readers. */}
          <span
            aria-hidden="true"
            className={classes(
              checked
                ? "border-transparent bg-primary-600"
                : "border-slate-400 bg-white",
              "flex h-4 w-4 flex-none items-center justify-center rounded-full border",
            )}
          >
            {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          {icon && (
            <Image
              data={icon}
              className="h-8 w-auto min-w-0 cursor-pointer rounded object-contain"
            />
          )}
          <Label
            className={
              icon ? "sr-only" : "cursor-pointer text-sm leading-tight"
            }
          >
            {label}
          </Label>
        </>
      )}
    </Radio>
  );
}

interface BankChooserProps {
  bankText: string | null;
  otherBankText: string | null;
  banks: StrapiBankIcon[];
  bank: string;
  setBank: (bank: string) => void;
}

export default function BankChooser({
  bankText,
  otherBankText,
  banks,
  bank,
  setBank,
}: BankChooserProps) {
  return (
    // Four in a row only where there's room for them and their radio
    // buttons, by the space it has rather than the screen's: beside the
    // form, the column is narrow.
    <RadioGroup value={bank} onChange={setBank} className="@container">
      <Label className="mb-2 block text-sm leading-6 font-medium text-slate-900">
        {bankText}
      </Label>
      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
        {banks
          .filter((b): b is typeof b & { bank: string } => b.bank !== null)
          .map(({ bank, icon }) => (
            <BankChooserOption
              key={bank}
              value={bank}
              label={bank}
              icon={icon}
            />
          ))}
        <BankChooserOption value="other" label={otherBankText} />
      </div>
    </RadioGroup>
  );
}
