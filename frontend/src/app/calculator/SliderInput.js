import { GCEvent } from "next-goatcounter";

export default function SliderInput({ percentage, setPercentage, min, max }) {
  return (
    <div className="flex w-full flex-row space-x-4">
      <div>{min}%</div>
      <div className="relative flex w-full flex-col justify-center">
        <div className="absolute my-auto h-3 w-full rounded-full bg-slate-200"></div>
        <div
          className="absolute my-auto h-3 w-1/2 rounded-full bg-primary-200"
          style={{ width: `${100 * (percentage / max)}%` }}
        ></div>
        <input
          className="form-range z-10"
          type="range"
          min={min}
          max={max}
          onInput={(event) => setPercentage(event.target.value)}
          onMouseUp={() => GCEvent("slider-change")}
          onTouchEnd={() => GCEvent("slider-change")}
          value={percentage}
        />
      </div>
      <div>{max}%</div>
    </div>
  );
}
