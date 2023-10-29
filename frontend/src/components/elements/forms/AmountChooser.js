import { classes } from "@/utils/react";
import { RadioGroup } from "@headlessui/react";
import { useEffect, useState } from "react";
import { validatePrice } from "@/utils/string";

function AmountInput({ amount, setAmount, currency, label, setErrors }) {
  const [localValue, setLocalValue] = useState(`${amount}`);

  const isValidAmount = validatePrice(localValue);

  useEffect(() => {
    if (isValidAmount) {
      setAmount(Number(localValue.replace(",", ".")));
      setErrors((errors) => ({ ...errors, amount: false }));
    } else {
      setErrors((errors) => ({ ...errors, amount: true }));
    }
  }, [localValue]);

  return (
    <div>
      <label htmlFor="amount" className="sr-only">
        {label}
      </label>
      <div className="relative rounded-md shadow-sm">
        <input
          type="text"
          name="amount"
          id="amount"
          className={classes(
            isValidAmount
              ? "ring-slate-300 focus:ring-primary-600"
              : "ring-red-500 focus:ring-red-500",
            "block w-full rounded-md border-0 py-2 pl-3 pr-8 text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:leading-6",
          )}
          maxLength={10}
          aria-describedby="amount-currency"
          value={localValue}
          placeholder={label}
          onInput={(event) => setLocalValue(event.target.value)}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-slate-500" id="amount-currency">
            {currency}
          </span>
        </div>
      </div>
    </div>
  );
}

function AmountChooserOption({ value, label }) {
  return (
    <RadioGroup.Option
      value={value}
      className={({ active, checked }) =>
        classes(
          checked
            ? "border-primary-600 ring-1 ring-primary-600"
            : "border-slate-300",
          active ? "bg-primary-50" : "",
          "relative flex cursor-pointer justify-center rounded-lg border p-3 text-slate-900 shadow-sm focus:outline-none",
        )
      }
    >
      <RadioGroup.Label className="cursor-pointer">{label}</RadioGroup.Label>
    </RadioGroup.Option>
  );
}

export default function AmountChooser({
  amount,
  setAmount,
  amountText,
  amountOptions,
  otherAmountText,
  otherAmountOptionText,
  currency,
  setErrors,
}) {
  const amountIsOption = amountOptions.find(
    (amountOption) => amountOption.value === amount,
  );
  const defaultAmount = amountIsOption ? amount : "other";
  const [selectedAmount, setSelectedAmount] = useState(defaultAmount);
  const otherAmountSelected = selectedAmount === "other";

  useEffect(() => {
    if (otherAmountSelected) return;
    setAmount(selectedAmount);
    setErrors((errors) => ({ ...errors, amount: false }));
  }, [selectedAmount]);

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup value={selectedAmount} onChange={setSelectedAmount}>
        <RadioGroup.Label className="sr-only">{amountText}</RadioGroup.Label>
        <div className="grid grid-cols-4 gap-3 xs:gap-4">
          {amountOptions.map((amountOption) => (
            <AmountChooserOption
              key={amountOption.value}
              value={amountOption.value}
              label={amountOption.label}
            />
          ))}
          <AmountChooserOption value="other" label={otherAmountOptionText} />
        </div>
      </RadioGroup>
      {otherAmountSelected && (
        <AmountInput
          amount={amount}
          setAmount={setAmount}
          currency={currency}
          label={otherAmountText}
          setErrors={setErrors}
        />
      )}
    </div>
  );
}
