/**
 * A fixed-window counter, kept in this process's memory.
 *
 * Deliberately not backed by Redis or the database: every caller here is
 * guarding something cheap (an outbound email, a password check), the counts
 * are worthless a window later, and a dependency on shared state would make a
 * failure in that store able to take down donations. The trade-offs that come
 * with that choice, and that callers should size their limits around:
 *
 *  - counts reset on restart or deploy, so a limit is a speed bump rather than
 *    a quota;
 *  - under a clustered process manager each worker keeps its own counts, so
 *    the effective limit is roughly `max × workers`;
 *  - a fixed window lets a caller spend `max` at the very end of one window and
 *    `max` again at the start of the next.
 *
 * All three argue for setting limits well below "what a legitimate user could
 * plausibly do" only where the protected action is genuinely rare.
 */

/**
 * True when an address is this app's own reverse proxy rather than a real
 * client — which is what every request looks like while SERVER_PROXY is off or
 * nothing upstream sets X-Forwarded-For.
 *
 * Any per-IP limit must consult this first. With one address shared by the
 * whole internet, a per-IP bucket stops being a limit on an individual and
 * becomes a limit on everyone at once: the first five visitors would use up
 * the hour's allowance and the sixth real donor would be turned away. Skip the
 * per-IP bucket in that case and lean on whatever other key the caller has.
 */
export function isProxyAddress(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

// Buckets are only cleaned up when the map gets big, rather than on a timer:
// a long-lived setInterval in a Strapi process keeps the event loop busy and
// has to be reasoned about on shutdown, and this costs nothing until there
// are enough distinct keys to matter.
const PRUNE_THRESHOLD = 1000;

export class FixedWindowLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Whether `key` has already used up its allowance, without consuming any. */
  isLimited(key: string): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || Date.now() > bucket.resetAt) return false;
    return bucket.count >= this.max;
  }

  /** Consume one unit of `key`'s allowance. */
  record(key: string): void {
    const now = Date.now();
    if (this.buckets.size >= PRUNE_THRESHOLD) this.prune(now);

    const bucket = this.buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      bucket.count++;
    }
  }

  /**
   * Consume one unit if any allowance remains, and report whether the caller
   * may proceed. With `max` of 5 the first five calls in a window return true
   * and the sixth returns false.
   */
  tryConsume(key: string): boolean {
    if (this.isLimited(key)) return false;
    this.record(key);
    return true;
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now > bucket.resetAt) this.buckets.delete(key);
    }
  }
}
