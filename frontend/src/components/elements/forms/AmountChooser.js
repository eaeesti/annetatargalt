import { classes } from "@/utils/react";
import { RadioGroup } from "@headlessui/react";
import { useEffect, useState } from "react";
import { validatePrice } from "@/utils/string";

function PriceInput({ price, setPrice, currency, label }) {
  const [localValue, setLocalValue] = useState(price);

  const isValidPrice = validatePrice(localValue);

  useEffect(() => {
    if (isValidPrice) {
      setPrice(localValue);
    }
  }, [isValidPrice, localValue, setPrice]);

  return (
    <div>
      <label htmlFor="price" className="sr-only">
        {label}
      </label>
      <div className="relative rounded-md shadow-sm">
        <input
          type="text"
          name="price"
          id="price"
          className={classes(
            isValidPrice
              ? "ring-slate-300 focus:ring-primary-600"
              : "ring-red-500 focus:ring-red-500",
            "block w-full rounded-md border-0 py-2 pl-3 pr-8 text-xl text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:leading-6",
          )}
          aria-describedby="price-currency"
          value={localValue}
          placeholder={label}
          onInput={(event) => setLocalValue(event.target.value)}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-xl text-slate-500" id="price-currency">
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
      <RadioGroup.Label>{label}</RadioGroup.Label>
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
}) {
  const defaultAmount = amountOptions[1].value;
  const [selectedAmount, setSelectedAmount] = useState(defaultAmount);
  const otherAmountSelected = selectedAmount === "other";

  useEffect(() => {
    if (otherAmountSelected) return;
    setAmount(selectedAmount);
  }, [otherAmountSelected, setAmount, selectedAmount]);

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup value={selectedAmount} onChange={setSelectedAmount}>
        <RadioGroup.Label className="text-base font-semibold leading-6 text-slate-900">
          {amountText}
        </RadioGroup.Label>

        <div className="mt-4 grid grid-cols-4 gap-3 xs:gap-4">
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
        <PriceInput
          price={amount}
          setPrice={setAmount}
          currency={currency}
          label={otherAmountText}
        />
      )}
    </div>
  );
}
