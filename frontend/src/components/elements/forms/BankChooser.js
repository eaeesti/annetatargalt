import { classes } from "@/utils/react";
import { RadioGroup } from "@headlessui/react";
import Image from "../Image";

function BankChooserOption({ value, label, icon }) {
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

export default function BankChooser({
  bankText,
  otherBankText,
  banks,
  bank,
  setBank,
}) {
  return (
    <RadioGroup value={bank} onChange={setBank}>
      <RadioGroup.Label className="mb-2 block text-sm font-medium leading-6 text-slate-900">
        {bankText}
      </RadioGroup.Label>
      <div className="grid grid-cols-3 gap-2 xs:gap-3">
        {banks.map(({ bank, icon }) => (
          <BankChooserOption value={bank} label={bank} icon={icon} />
        ))}
        <BankChooserOption value="other" label={otherBankText} />
      </div>
    </RadioGroup>
  );
}
