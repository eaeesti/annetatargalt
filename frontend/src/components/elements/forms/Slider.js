export default function Slider({
  id,
  min = 0,
  max = 100,
  value,
  setValue,
  onMouseUp,
  ...props
}) {
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
        onInput={(event) => setValue(Number(event.target.value))}
        onMouseUp={onMouseUp}
        onTouchEnd={onMouseUp}
        aria-valuenow={value}
        value={value}
        {...props}
      />
    </div>
  );
}
