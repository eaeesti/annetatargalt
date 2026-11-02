import { Fragment, useEffect, useRef, useState } from "react";
import { UserGroupIcon } from "@heroicons/react/24/solid";
import Image from "../Image";
import Markdown from "../Markdown";
import HoverCard from "./HoverCard";
import {
  DAYS_PER_MONTH,
  euroIncome,
  formatNumber,
  internationalIncome,
  WORLD_PERCENTILES,
  worldPercentileOfInternational,
} from "@/utils/income";
import type { Locale } from "@/utils/locale";
import { withCurrency } from "@/utils/money";
import { classes } from "@/utils/react";
import { format } from "@/utils/string";
import type { StrapiIncomeFamily } from "@/types/generated/strapi";

/**
 * A bar for each percent of the world, from the poorest to the richest, as
 * high as the daily income its richest live on. The data stops at the 99th
 * percentile, so the last bar, the richest percent, continues the line from
 * the 98th, as the scale past the 99th does.
 */
const BARS = (() => {
  const daily = WORLD_PERCENTILES.map((point) => point.daily);
  const [secondLast = 0, last = 0] = daily.slice(-2);
  return [...daily, 2 * last - secondLast];
})();
const HIGHEST = Math.max(...BARS);
/** The share of the chart at each end where the visitor's marks slide in. */
const EDGE = 0.1;

/** The bars' colours from the poorest to the richest: grey, then greener. */
const COLOR_STOPS = [
  { stop: 0, color: [226, 232, 240] },
  { stop: 0.3, color: [226, 232, 240] },
  { stop: 0.8, color: [178, 221, 201] },
  { stop: 0.9, color: [129, 206, 176] },
  { stop: 1, color: [26, 171, 124] },
];

function barColor(share: number): string {
  const upper = COLOR_STOPS.find(({ stop }) => stop >= share) ?? COLOR_STOPS[0];
  const lower =
    COLOR_STOPS.findLast(({ stop }) => stop <= share) ?? COLOR_STOPS[0];
  const t =
    upper.stop === lower.stop
      ? 0
      : (share - lower.stop) / (upper.stop - lower.stop);
  const [r, g, b] = lower.color.map((value, index) =>
    Math.round(value + (upper.color[index] - value) * t),
  );
  return `rgb(${r}, ${g}, ${b})`;
}

interface TileProps {
  children: React.ReactNode;
  className?: string;
}

/** A rounded square, the way the families are shown under the chart. */
function Tile({ children, className }: TileProps) {
  return (
    <span
      className={classes(
        "block h-14 w-14 overflow-hidden rounded-xl shadow-lg ring-4 ring-white sm:h-20 sm:w-20",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A bar's height, in percent of the tallest's, but always to be seen. */
function barHeight(daily: number) {
  return Math.max((100 * daily) / HIGHEST, 0.8);
}

/** Where on the chart a place on the scale of 0 to 100 is, from 0 to 1. */
function shareOf(position: number) {
  return position / 100;
}

/** Space kept between two tiles, in pixels. */
const TILE_GAP = 8;
/** How far below the chart the tiles are, in pixels: room for the lines. */
const LINK_HEIGHT = 24;

/**
 * Where each line from a bar down to its moved tile turns sideways, in pixels
 * from the top. Lines of tiles moved the same way turn at different heights,
 * the one that goes past the others lowest, so that none runs over another.
 */
function turnHeights(from: number[], to: number[]): number[] {
  const heights = from.map(() => LINK_HEIGHT / 2);
  const indices = from.map((_, index) => index);
  const left = indices
    .filter((index) => to[index] < from[index] - 1)
    .sort((a, b) => from[a] - from[b]);
  const right = indices
    .filter((index) => to[index] > from[index] + 1)
    .sort((a, b) => from[b] - from[a]);
  for (const group of [left, right]) {
    group.forEach((index, rank) => {
      heights[index] = Math.min(6 + rank * 5, LINK_HEIGHT - 4);
    });
  }
  return heights;
}

/**
 * The centres of tiles of the given width, moved apart as little as possible
 * so that none covers another, and kept inside the width. Where there isn't
 * room for them all, they end up as evenly squeezed as they can be.
 */
function spread(centres: number[], width: number, tile: number): number[] {
  const order = centres.map((_, index) => index);
  order.sort((a, b) => centres[a] - centres[b]);
  const clamp = (x: number) =>
    Math.min(Math.max(x, tile / 2), width - tile / 2);
  const xs = order.map((index) => clamp(centres[index]));
  for (let round = 0; round < 200; round++) {
    let moved = false;
    for (let i = 1; i < xs.length; i++) {
      const overlap = xs[i - 1] + tile + TILE_GAP - xs[i];
      if (overlap > 0.5) {
        xs[i - 1] = clamp(xs[i - 1] - overlap / 2);
        xs[i] = clamp(xs[i] + overlap / 2);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const result = [...centres];
  order.forEach((index, i) => {
    result[index] = xs[i];
  });
  return result;
}

interface FamilyProps {
  family: StrapiIncomeFamily;
  /** Where the family's tile is, as a CSS left. */
  left: string;
  /** The same, from 0 to 1, for where the card hangs. */
  share: number;
  perDayText: string | null;
  perMonthText: string | null;
  creditText: string | null;
  locale: Locale;
}

function Family({
  family,
  left,
  share,
  perDayText,
  perMonthText,
  creditText,
  locale,
}: FamilyProps) {
  const monthly = euroIncome(family.monthlyIncome ?? 0);
  const amount = (value: number, digits: number) =>
    withCurrency(formatNumber(value, locale, digits), "€", locale);
  return (
    <HoverCard
      label={family.name ?? ""}
      share={share}
      className={classes(
        "absolute top-6 -translate-x-1/2",
        family.hiddenOnPhones && "hidden sm:block",
      )}
      style={{ left }}
      cardClassName="w-80"
      button={
        <Tile className="transition-transform group-hover:scale-105 group-focus-visible:ring-primary-600 group-data-open:ring-primary-600">
          <Image
            data={family.familyPhoto}
            className="h-full w-full object-cover"
            sizes="120px"
          />
        </Tile>
      }
    >
      <Image
        data={family.homePhoto}
        className="aspect-[4/3] w-full object-cover"
        sizes="320px"
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-900">{family.name}</p>
            <p>{family.household}</p>
            <p>{family.home}</p>
          </div>
          <div className="text-right whitespace-nowrap">
            <p className="font-semibold text-slate-900">
              {format(perDayText ?? "", {
                amount: amount(monthly / DAYS_PER_MONTH, 2),
              })}
            </p>
            <p>{format(perMonthText ?? "", { amount: amount(monthly, 0) })}</p>
          </div>
        </div>
        <p className="text-xs leading-5">{family.description}</p>
        <Markdown className="prose-xs prose text-xs text-slate-500 prose-primary">
          {format(creditText ?? "", { url: family.sourceUrl ?? "" })}
        </Markdown>
      </div>
    </HoverCard>
  );
}

interface WorldIncomeChartProps {
  /** How much of the world is poorer than the visitor, as the headline says. */
  percentile: number;
  /** The household's monthly income in euros, per person by the OECD scale. */
  perPersonIncome: number;
  /** The household's monthly income in euros, as it was typed. */
  householdIncome: number;
  families: StrapiIncomeFamily[];
  youText: string | null;
  /** The heading of the visitor's card, "You in Estonia". */
  youCardTitle: string | null;
  /** The visitor's household in words, "1 adult, 2 children". */
  household: string;
  /** The visitor's income, with its currency. */
  income: string;
  incomeLabel: string | null;
  perDayText: string | null;
  perMonthText: string | null;
  creditText: string | null;
  /** Under the chart, what the bars are: they're easily read as counts. */
  caption: string | null;
  locale: Locale;
}

/**
 * The world's incomes, a bar for each percent of people from the poorest to
 * the richest, with the visitor's marked and families from along the way
 * under it.
 */
export default function WorldIncomeChart({
  percentile,
  perPersonIncome,
  householdIncome,
  families,
  youText,
  youCardTitle,
  household,
  income,
  incomeLabel,
  perDayText,
  perMonthText,
  creditText,
  caption,
  locale,
}: WorldIncomeChartProps) {
  // The visitor's bar is the percent the headline puts them in: richer than
  // 90% is the 91st bar, with 90 to its left and the top 10% from it on.
  const yours = Math.min(Math.max(Math.floor(percentile) + 1, 1), 100);
  const share = shareOf(yours - 0.5);
  // The visitor's bar is as high as their own income, which the scale on
  // the right gives in the household's terms: 0, theirs, and the line above
  // which the richest percent lives, where the data stops.
  const yourHeight = barHeight(
    internationalIncome(perPersonIncome) / DAYS_PER_MONTH,
  );
  const perHousehold = householdIncome / perPersonIncome;
  const richestFrom =
    Math.round(
      (euroIncome(BARS[BARS.length - 2] * DAYS_PER_MONTH) * perHousehold) / 100,
    ) * 100;
  const scale = [
    { key: "zero", height: 0, text: withCurrency(0, "€", locale) },
    {
      key: "yours",
      height: Math.min(yourHeight, 100),
      text: income,
      yours: true,
    },
    {
      key: "richest",
      // the visitor's own bar, when they're in the richest percent
      height: yours === BARS.length ? Math.min(yourHeight, 100) : 100,
      text: withCurrency(`${formatNumber(richestFrom, locale)}+`, "€", locale),
    },
  ].filter(
    // the visitor's own label wins where two would overlap
    ({ key, height }) =>
      key === "yours" || Math.abs(height - Math.min(yourHeight, 100)) > 10,
  );
  // The label over the visitor's bar is centred on it, but slid inwards in
  // the outer tenths of the chart, so that at the very end its edge is at the
  // bar.
  const shift =
    share < EDGE
      ? (share / EDGE) * 50
      : share > 1 - EDGE
        ? 50 + ((share - (1 - EDGE)) / EDGE) * 50
        : 50;
  const inside = `${-shift}% 0`;
  const placed = families.map((family) => ({
    family,
    position: worldPercentileOfInternational(family.monthlyIncome ?? 0),
  }));

  // The tiles under the chart start under their bars and are then moved
  // apart where they'd cover each other, which takes the chart's width: until
  // it's known, they stay under their bars.
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; wide: boolean } | null>(
    null,
  );
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const wide = window.matchMedia("(min-width: 640px)");
    const update = () =>
      setSize({ width: chart.clientWidth, wide: wide.matches });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  // The visitor's tile last, after the families shown at this width.
  const shown = placed.filter(
    ({ family }) => !size || size.wide || !family.hiddenOnPhones,
  );
  const shares = [...shown.map(({ position }) => shareOf(position)), share];
  const tileShares = size
    ? spread(
        shares.map((x) => x * size.width),
        size.width,
        // The tiles are 3.5rem wide, 5rem from sm up.
        size.wide ? 80 : 56,
      ).map((x) => x / size.width)
    : shares;
  const yourTileShare = tileShares[tileShares.length - 1];
  // Until the width is known the tiles are under their bars, so the lines go
  // straight down, but only in pixels can they turn.
  const width = size?.width ?? 0;
  const from = shares.map((x) => x * width);
  const to = tileShares.map((x) => x * width);
  const turns = turnHeights(from, to);
  const links = shares.map((x, index) => ({
    key: index < shown.length ? String(shown[index].family.id) : "you",
    yours: index === shown.length,
    d: size
      ? `M${from[index]} 0V${turns[index]}H${to[index]}V${LINK_HEIGHT}`
      : "",
    x,
  }));
  const tileOf = (family: StrapiIncomeFamily) => {
    const index = shown.findIndex((item) => item.family.id === family.id);
    return index === -1 ? null : tileShares[index];
  };
  return (
    <div className="relative mx-auto w-full max-w-6xl pr-20 pl-4 sm:pr-24 sm:pl-8">
      <div
        ref={chartRef}
        className="relative flex h-48 items-end gap-px border-b border-slate-300 sm:h-80 sm:gap-0.5"
        aria-hidden
      >
        {BARS.map((daily, index) => {
          const bar = index + 1;
          const isYours = bar === yours;
          return (
            <div
              key={bar}
              className={classes(
                "relative flex-1 origin-bottom rounded-t-[1px] motion-safe:animate-grow-up",
                isYours && "bg-primary-800",
              )}
              style={{
                height: `${isYours ? Math.min(yourHeight, 100) : barHeight(daily)}%`,
                backgroundColor: isYours
                  ? undefined
                  : barColor(index / (BARS.length - 1)),
              }}
            >
              {isYours && (
                <>
                  <span className="absolute bottom-full left-1/2 h-6 w-0.5 -translate-x-1/2 bg-primary-800" />
                  <span
                    className="absolute bottom-full left-1/2 mb-6 text-lg font-semibold whitespace-nowrap text-primary-800"
                    style={{ translate: inside }}
                  >
                    {youText}
                  </span>
                </>
              )}
            </div>
          );
        })}
        <div className="absolute inset-y-0 left-full ml-1.5 sm:ml-3">
          {scale.map(({ key, height, text, yours: isYours }) => (
            <span
              key={key}
              className={classes(
                "absolute left-0 translate-y-1/2 text-xs whitespace-nowrap sm:text-sm",
                isYours ? "font-semibold text-primary-800" : "text-slate-500",
              )}
              style={{ bottom: `${height}%` }}
            >
              {text}
            </span>
          ))}
        </div>
      </div>
      <div className="relative h-28 sm:h-36">
        {/* From each bar down to its tile, turning sideways and down again
            where the tile was moved. */}
        <svg
          className="absolute inset-x-0 top-0 h-6 w-full overflow-visible"
          aria-hidden
        >
          {links.map(({ key, d, x, yours: isYours }) => {
            const stroke = {
              className: isYours ? "stroke-primary-800" : "stroke-slate-300",
              strokeWidth: isYours ? 2 : 1,
            };
            return d ? (
              <path key={key} d={d} fill="none" {...stroke} />
            ) : (
              <line
                key={key}
                x1={`${x * 100}%`}
                y1="0"
                x2={`${x * 100}%`}
                y2="100%"
                {...stroke}
              />
            );
          })}
        </svg>
        {placed.map(({ family, position }) => {
          const tileShare = tileOf(family) ?? shareOf(position);
          return (
            <Family
              key={family.id}
              family={family}
              left={`${tileShare * 100}%`}
              share={tileShare}
              perDayText={perDayText}
              perMonthText={perMonthText}
              creditText={creditText}
              locale={locale}
            />
          );
        })}
        <HoverCard
          label={youText ?? ""}
          share={yourTileShare}
          className="absolute top-6 -translate-x-1/2"
          style={{ left: `${yourTileShare * 100}%` }}
          cardClassName="flex w-64 flex-col gap-3 p-4"
          button={
            <Tile className="bg-primary-700 transition-transform group-hover:scale-105 group-focus-visible:ring-primary-600 group-data-open:ring-primary-600">
              <span className="flex h-full w-full items-center justify-center">
                <UserGroupIcon className="h-6 w-6 text-white sm:h-8 sm:w-8" />
              </span>
            </Tile>
          }
        >
          <div>
            <p className="font-semibold text-slate-900">
              {youCardTitle ?? youText}
            </p>
            <p>{household}</p>
          </div>
          <div>
            <p className="text-xs">{incomeLabel}</p>
            <p className="font-semibold text-slate-900">{income}</p>
          </div>
        </HoverCard>
      </div>
      {caption && (
        <p className="mx-auto max-w-3xl text-center text-sm text-balance text-slate-500">
          {/* A sentence that doesn't fit after the one before goes to the
              next line whole, instead of breaking in the middle. */}
          {caption.split(/(?<=\.)\s+/).map((sentence, index) => (
            <Fragment key={index}>
              {index > 0 && " "}
              <span className="inline-block">{sentence}</span>
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );
}
