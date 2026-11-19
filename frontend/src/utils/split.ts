/**
 * Whole-percent splits for the donation form's split bars: a donation's
 * causes, and a cause's organizations. Every chosen one keeps at least 1%.
 */

/**
 * `count` equal shares of `total`, the first ones taking what doesn't divide:
 * 100; 50 / 50; 34 / 33 / 33.
 */
export function evenShares(count: number, total = 100): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Support for the platform's share when it's chosen beside causes. */
export const SUPPORT_SHARE = 5;

/**
 * How a donation is split when the donor ticks or unticks a choice: evenly
 * between the causes chosen, and when support for the platform is chosen
 * too, 5% for it (the last share) and the rest evenly between the causes.
 * Support on its own gets all of it.
 */
export function startingShares(causes: number, withSupport: boolean): number[] {
  if (!withSupport) return evenShares(causes);
  if (causes === 0) return [100];
  return [...evenShares(causes, 100 - SUPPORT_SHARE), SUPPORT_SHARE];
}

/**
 * The shares with the border after `index` moved to `position`, a point along
 * the bar from 0 to 100. Only the two shares on either side of it change, so
 * the total stays the same, and neither goes below 1.
 */
export function moveBorder(
  shares: number[],
  index: number,
  position: number,
): number[] {
  if (index < 0 || index >= shares.length - 1) return shares;
  const start = shares.slice(0, index).reduce((sum, share) => sum + share, 0);
  const end = start + shares[index] + shares[index + 1];
  const border = Math.max(start + 1, Math.min(end - 1, Math.round(position)));
  const moved = shares.slice();
  moved[index] = border - start;
  moved[index + 1] = end - border;
  return moved;
}

/** Whether these shares are the even split of as many. */
export function isEven(shares: number[]): boolean {
  const even = evenShares(shares.length);
  return shares.every((share, i) => share === even[i]);
}

function sum(shares: number[]): number {
  return shares.reduce((total, share) => total + share, 0);
}

function sameShares(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((share, i) => share === b[i]);
}

/**
 * `shares` scaled to add up to `total`, in the same proportions as near as
 * whole percents allow: each rounds down, and what's left goes one by one to
 * the largest remainders (the earlier one on a tie). None goes below 1.
 */
export function scaleShares(shares: number[], total: number): number[] {
  if (shares.length === 0) return [];
  const before = sum(shares);
  if (before <= 0) return evenShares(shares.length, total);
  const exact = shares.map((share) => (share * total) / before);
  const scaled = exact.map((share) => Math.max(1, Math.floor(share)));
  const byRemainder = exact
    .map((share, i) => ({ i, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  let left = total - sum(scaled);
  for (let k = 0; left > 0; k = (k + 1) % byRemainder.length) {
    scaled[byRemainder[k].i] += 1;
    left -= 1;
  }
  // Too much, from lifting a share to 1: the largest gives it back.
  while (left < 0) {
    const largest = scaled.indexOf(Math.max(...scaled));
    if (scaled[largest] <= 1) break;
    scaled[largest] -= 1;
    left += 1;
  }
  return scaled;
}

/**
 * The split a donation starts with for the choices that are `on` (see
 * startingShares), as every choice's share in order: 0 for those not
 * chosen. Support for the platform is the one at `supportIndex`, -1 if none.
 */
export function startingSplit(on: boolean[], supportIndex: number): number[] {
  const causes = on.flatMap((chosen, i) =>
    chosen && i !== supportIndex ? [i] : [],
  );
  const withSupport = supportIndex >= 0 && on[supportIndex] === true;
  const start = startingShares(causes.length, withSupport);
  const split = on.map(() => 0);
  causes.forEach((i, k) => {
    split[i] = start[k];
  });
  if (withSupport) split[supportIndex] = start[start.length - 1];
  return split;
}

/** Whether the shares are still the split they started with. */
export function isStartingSplit(
  shares: number[],
  supportIndex: number,
): boolean {
  return sameShares(
    shares,
    startingSplit(
      shares.map((share) => share > 0),
      supportIndex,
    ),
  );
}

/**
 * The split once the choice at `index` is ticked or unticked. `shares` are
 * every choice's, in order, 0 for those not chosen; support for the platform
 * is the one at `supportIndex` (-1 if none).
 *
 * A split as it started stays one, for the new choices. One the donor has
 * adjusted keeps its proportions instead of starting over:
 * - a cause ticked gets an even share of what the causes have, and the
 *   others make room for it in proportion;
 * - support ticked gets 5%, and the causes make room in proportion;
 * - anything unticked leaves its share to the rest in proportion.
 * Support keeps its share as causes come and go, unless it's alone: then it
 * has all of it, and the first cause ticked beside it starts at 95 / 5.
 */
export function toggledShares(
  shares: number[],
  index: number,
  supportIndex: number,
): number[] {
  const on = shares.map((share) => share > 0);
  const next = on.map((chosen, i) => (i === index ? !chosen : chosen));
  if (isStartingSplit(shares, supportIndex)) {
    return startingSplit(next, supportIndex);
  }

  const split = shares.map(() => 0);
  const causes = next.flatMap((chosen, i) =>
    chosen && i !== supportIndex ? [i] : [],
  );
  const supportOn = supportIndex >= 0 && next[supportIndex] === true;
  if (causes.length === 0) {
    if (supportOn) split[supportIndex] = 100;
    return split;
  }

  let support = 0;
  if (supportOn) {
    const supportWasAlone = !on.some(
      (chosen, i) => chosen && i !== supportIndex,
    );
    support =
      index === supportIndex || supportWasAlone
        ? SUPPORT_SHARE
        : shares[supportIndex];
    // room for every cause to have at least 1
    support = Math.min(support, 100 - causes.length);
    split[supportIndex] = support;
  }

  const causesTotal = 100 - support;
  const ticked = !on[index] && index !== supportIndex ? index : -1;
  const others = causes.filter((i) => i !== ticked);
  let othersTotal = causesTotal;
  if (ticked >= 0) {
    const share =
      others.length === 0
        ? causesTotal
        : Math.max(
            1,
            Math.min(
              causesTotal - others.length,
              Math.round(causesTotal / causes.length),
            ),
          );
    split[ticked] = share;
    othersTotal = causesTotal - share;
  }
  scaleShares(
    others.map((i) => shares[i]),
    othersTotal,
  ).forEach((share, k) => {
    split[others[k]] = share;
  });
  return split;
}
