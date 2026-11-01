import { useEffect, useId, useRef, useState } from "react";
import { classes } from "@/utils/react";

interface HoverCardProps {
  /** What the button is called, for screen readers. */
  label: string;
  button: React.ReactNode;
  children: React.ReactNode;
  /**
   * Where the button is across the chart, from 0 to 1: the card hangs to its
   * right at 0, is centred at 0.5 and hangs to its left at 1, so that it stays
   * inside the chart.
   */
  share: number;
  className?: string;
  style?: React.CSSProperties;
  cardClassName?: string;
}

/** Sent when a card opens, so that any other one closes. */
const OPENED = "hover-card-opened";

/**
 * A button with a card above it, shown while a mouse is over either. Where
 * there's no mouse to hover with, a tap or the keyboard keeps it open until
 * the next one, a tap elsewhere or Escape. Only one card is open at a time.
 */
export default function HoverCard({
  label,
  button,
  children,
  share,
  className,
  style,
  cardClassName,
}: HoverCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // What pressed the button last; a mouse click doesn't pin the card, since
  // hovering already shows it.
  const pointerType = useRef("");
  const id = useId();
  const open = hovered || pinned;

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(OPENED, { detail: id }));
    const otherOpened = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== id) {
        setPinned(false);
        setHovered(false);
      }
    };
    window.addEventListener(OPENED, otherOpened);
    return () => window.removeEventListener(OPENED, otherOpened);
  }, [open, id]);

  useEffect(() => {
    if (!open) return;
    const clickElsewhere = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !ref.current?.contains(event.target)
      ) {
        setPinned(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinned(false);
        setHovered(false);
      }
    };
    document.addEventListener("pointerdown", clickElsewhere);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", clickElsewhere);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={classes(className, open && "z-30")}
      style={style}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
    >
      <button
        type="button"
        className="group flex cursor-pointer flex-col items-center outline-none"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        data-open={open || undefined}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
        }}
        onClick={() => {
          if (pointerType.current !== "mouse") {
            setPinned((wasPinned) => !wasPinned);
          }
          pointerType.current = "";
        }}
      >
        {button}
      </button>
      {open && (
        // The padding, not a margin, keeps the mouse over the card on its way
        // up from the button.
        <div
          id={id}
          className="absolute bottom-full left-1/2 pb-3"
          style={{ translate: `${-share * 100}% 0` }}
        >
          <div
            className={classes(
              "animate-fade-in overflow-hidden rounded-xl bg-white text-left text-sm text-slate-700 shadow-2xl ring-1 ring-slate-900/5",
              cardClassName,
            )}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
