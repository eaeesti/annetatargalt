import { classes } from "@/utils/react";
import { useEffect, useState } from "react";

export default function TextInput({
  name,
  value,
  setValue,
  setValidity,
  isValid,
  label,
  placeholder,
  autoComplete,
  autoFocus = false,
  maxLength = 128,
  description,
}) {
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isValid(value)) {
      setValidity((ready) => ({ ...ready, [name]: true }));
    } else {
      setValidity((ready) => ({ ...ready, [name]: false }));
    }
  }, [value]);

  return (
    <div className="">
      <label
        htmlFor={name}
        className="block text-sm font-medium leading-6 text-slate-900"
      >
        {label}
      </label>
      <div className="mt-2">
        <input
          type="text"
          name={name}
          id={name}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          className={classes(
            error
              ? "ring-red-500 focus:ring-red-500"
              : "ring-slate-300 focus:ring-primary-600",
            "block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6",
          )}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(!isValid(event.target.value));
          }}
          onBlur={() => setError(!isValid(value))}
          placeholder={placeholder}
        />
      </div>
      {description && (
        <p className="mt-2 text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}
