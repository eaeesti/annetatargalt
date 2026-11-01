"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Variable } from "./types";

const VARIABLE = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * The "{{" being typed before the caret: where it starts, what's typed
 * after it, and where it ends, past the rest of its name and a "}}" already
 * there. Null in a whole variable, whose Enter and Tab are the text's own.
 */
function typedVariable(text: string, caret: number, known: Set<string>) {
  const before = /\{\{\s*(\w*)$/.exec(text.slice(0, caret));
  if (!before) return null;
  const query = before[1] ?? "";
  const after = /^(\w*)(\s*\}\})?/.exec(text.slice(caret));
  if (after?.[2] && known.has(query + (after[1] ?? ""))) return null;
  return {
    start: before.index,
    end: caret + (after?.[0].length ?? 0),
    query,
  };
}

/**
 * The text again, behind the textarea and in the same place, with each
 * {{variable}} as a chip: green when the email can have it, red when it
 * can't. Its letters are invisible, the textarea's show on top. A marker at
 * the caret tells where to open the list of variables.
 */
function Backdrop({
  text,
  caret,
  known,
  markerRef,
}: {
  text: string;
  caret: number;
  known: Set<string>;
  markerRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  const pushText = (until: number) => {
    if (caret >= at && caret <= until) {
      parts.push(text.slice(at, caret));
      parts.push(<span key="caret" ref={markerRef} />);
      parts.push(text.slice(caret, until));
    } else {
      parts.push(text.slice(at, until));
    }
    at = until;
  };
  for (const match of text.matchAll(VARIABLE)) {
    pushText(match.index);
    const end = match.index + match[0].length;
    // the caret in a variable, as when one is being fixed
    const split = caret > match.index && caret < end ? caret - match.index : 0;
    parts.push(
      <mark
        key={match.index}
        className={cn(
          "rounded-sm text-transparent",
          known.has(match[1] ?? "")
            ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-900/50 dark:ring-emerald-700"
            : "bg-red-100 ring-1 ring-red-300 dark:bg-red-900/50 dark:ring-red-700",
        )}
      >
        {split ? (
          <>
            {match[0].slice(0, split)}
            <span ref={markerRef} />
            {match[0].slice(split)}
          </>
        ) : (
          match[0]
        )}
      </mark>,
    );
    at = end;
  }
  pushText(text.length);
  // a last empty line has to take its room too
  parts.push("​");
  return <>{parts}</>;
}

/**
 * A textarea for an email's text, where variables are typed as {{name}}:
 * typing "{{" lists them at the caret, and the menu below puts one in.
 * `singleLine` makes it a one-line field, like the subject.
 */
export function VariableText({
  value,
  onChange,
  variables,
  singleLine = false,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  singleLine?: boolean;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [chosen, setChosen] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [popup, setPopup] = useState<{ top: number; left: number } | null>(
    null,
  );

  const known = new Set(variables.map((v) => v.name));
  const typed = focused ? typedVariable(value, caret, known) : null;
  const matches = typed
    ? variables.filter(
        (v) =>
          v.name.toLowerCase().includes(typed.query.toLowerCase()) ||
          v.label.toLowerCase().includes(typed.query.toLowerCase()),
      )
    : [];
  const open =
    Boolean(typed) && matches.length > 0 && dismissedAt !== typed?.start;

  // as tall as its text
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);

  useLayoutEffect(() => {
    const at = marker.current;
    if (!open || !at) return setPopup(null);
    setPopup({ top: at.offsetTop + 24, left: at.offsetLeft });
  }, [open, value, caret]);

  function trackCaret() {
    setCaret(textarea.current?.selectionStart ?? 0);
  }

  /** Put {{name}} in place of the "{{…" typed, or of what's selected. */
  function insert(name: string, typing?: { start: number; end: number }) {
    const el = textarea.current;
    const start = typing?.start ?? el?.selectionStart ?? value.length;
    const end = typing?.end ?? el?.selectionEnd ?? start;
    const inserted = `{{${name}}}`;
    onChange(value.slice(0, start) + inserted + value.slice(end));
    const position = start + inserted.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(position, position);
      setCaret(position);
    });
    setChosen(0);
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden rounded-lg border border-transparent px-2.5 py-1.5 text-sm leading-6 break-words whitespace-pre-wrap text-transparent",
          )}
        >
          <Backdrop
            text={value}
            caret={caret}
            known={known}
            markerRef={marker}
          />
        </div>
        <textarea
          ref={textarea}
          aria-label={label}
          rows={1}
          value={value}
          placeholder={placeholder}
          spellCheck
          className="relative block w-full resize-none overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm leading-6 break-words whitespace-pre-wrap outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(event) => {
            onChange(
              singleLine
                ? event.target.value.replace(/\n/g, " ")
                : event.target.value,
            );
            setCaret(event.target.selectionStart);
            setDismissedAt(null);
          }}
          onSelect={trackCaret}
          onClick={trackCaret}
          onFocus={() => {
            setFocused(true);
            trackCaret();
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (open && typed) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : -1;
                setChosen((chosen + step + matches.length) % matches.length);
                return;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                const variable = matches[chosen] ?? matches[0];
                if (variable) insert(variable.name, typed);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setDismissedAt(typed.start);
                return;
              }
            }
            if (singleLine && event.key === "Enter") event.preventDefault();
          }}
        />
        {open && popup && typed && (
          <ul
            role="listbox"
            aria-label="Variables"
            className="absolute z-20 max-h-60 w-64 overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
            style={{ top: popup.top, left: Math.max(0, popup.left - 16) }}
          >
            {matches.map((variable, index) => (
              <li
                key={variable.name}
                role="option"
                aria-selected={index === chosen}
                className={cn(
                  "flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-2 py-1",
                  index === chosen && "bg-accent text-accent-foreground",
                )}
                // before the textarea loses focus to the click
                onMouseDown={(event) => {
                  event.preventDefault();
                  insert(variable.name, typed);
                }}
                onMouseEnter={() => setChosen(index)}
              >
                <span className="font-mono text-xs">{variable.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {variable.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <select
        aria-label={`Insert a variable into ${label}`}
        // as wide as its longest variable, but not past the text above
        className="max-w-full rounded-md bg-transparent text-xs text-muted-foreground hover:text-foreground"
        value=""
        onChange={(event) => {
          if (event.target.value) {
            insert(
              event.target.value,
              typedVariable(value, caret, known) ?? undefined,
            );
          }
        }}
      >
        <option value="">Insert variable…</option>
        {variables.map((variable) => (
          <option key={variable.name} value={variable.name}>
            {variable.label} ({`{{${variable.name}}}`})
          </option>
        ))}
      </select>
    </div>
  );
}
