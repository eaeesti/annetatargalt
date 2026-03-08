import { classes } from "@/utils/react";
import { RadioGroup } from "@headlessui/react";
import Image from "../Image";
import type { StrapiBankIcon } from "@/types/generated/strapi";

interface BankChooserOptionProps {
  value: string;
  label: string;
  icon?: StrapiBankIcon["icon"];
}

function BankChooserOption({ value, label, icon }: BankChooserOptionProps) {
  return (
    <RadioGroup.Option
      value={value}
      className={({ active, checked }) =>
        classes(
          checked
            ? "border-primary-600 ring-1 ring-primary-600"
            : "border-slate-300",
          active ? "bg-primary-50" : "",
          "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border text-slate-900 shadow-sm focus:outline-none",
        )
      }
    >
      {icon && <Image data={icon} className="h-full w-full cursor-pointer" />}
      <RadioGroup.Label className={icon ? "sr-only" : "cursor-pointer text-sm"}>
        {label}
      </RadioGroup.Label>
    </RadioGroup.Option>
  );
}

interface BankChooserProps {
  bankText: string;
  otherBankText: string;
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
    <RadioGroup value={bank} onChange={setBank}>
      <RadioGroup.Label className="mb-2 block text-sm font-medium leading-6 text-slate-900">
        {bankText}
      </RadioGroup.Label>
      <div className="grid grid-cols-3 gap-2 xs:gap-3">
        {banks.map(({ bank, icon }) => (
          <BankChooserOption key={bank!} value={bank!} label={bank!} icon={icon} />
        ))}
        <BankChooserOption value="other" label={otherBankText} />
      </div>
    </RadioGroup>
  );
}
