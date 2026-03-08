interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onMouseUp" | "min" | "max"> {
  id?: string;
  min?: number;
  max?: number;
  value: number;
  setValue: (value: number) => void;
  onMouseUp?: () => void;
}

export default function Slider({
  id,
  min = 0,
  max = 100,
  value,
  setValue,
  onMouseUp,
  ...props
}: SliderProps) {
  return (
    <div className="relative flex w-full flex-col justify-center">
      <div className="absolute my-auto h-2.5 w-full rounded-full bg-slate-200"></div>
      <div
        className="absolute my-auto h-2.5 rounded-full bg-primary-200"
        style={{ width: `${value}%` }}
      ></div>
      <input
        role="slider"
        className="form-range z-0"
        type="range"
        min={min}
        aria-valuemin={min}
        max={max}
        aria-valuemax={max}
        onInput={(event) => setValue(Number(event.currentTarget.value))}
        onMouseUp={onMouseUp}
        onTouchEnd={onMouseUp}
        aria-valuenow={value}
        value={value}
        {...props}
      />
    </div>
  );
}
