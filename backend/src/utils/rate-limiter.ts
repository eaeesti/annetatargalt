import { BlockList, isIP } from "node:net";

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

/** Loopback and the private ranges, always internal. */
const PRIVATE_NETWORKS = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "::1/128",
  "fc00::/7",
];

/**
 * Networks given as "address/prefix", e.g. "172.41.0.0/24", and the entries
 * that aren't one.
 */
export function parseNetworks(entries: string[]): {
  networks: BlockList;
  invalid: string[];
} {
  const networks = new BlockList();
  const invalid: string[] = [];
  for (const entry of entries) {
    const [address = "", prefix = "", ...rest] = entry.split("/");
    const version = isIP(address);
    const bits = Number(prefix);
    if (
      version === 0 ||
      rest.length > 0 ||
      !/^\d+$/.test(prefix) ||
      bits > (version === 4 ? 32 : 128)
    ) {
      invalid.push(entry);
      continue;
    }
    networks.addSubnet(address, bits, version === 4 ? "ipv4" : "ipv6");
  }
  return { networks, invalid };
}

/** INTERNAL_NETWORKS, comma-separated. */
export function configuredNetworks(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

let internal: { raw: string | undefined; networks: BlockList } | null = null;

/**
 * True when a request comes from this machine or its own networks rather
 * than from a visitor: the reverse proxy itself (all a request shows while
 * SERVER_PROXY is off or nothing upstream sets X-Forwarded-For), or the
 * site's and the admin panel's servers, which reach this app from their
 * containers' networks. That's loopback and the private ranges, plus
 * INTERNAL_NETWORKS for container networks outside them.
 *
 * Any per-IP limit must consult this first. Each of those addresses stands
 * for many people at once, so a bucket keyed on one stops being a limit on an
 * individual and becomes a limit on everyone: the first five visitors would
 * use up the hour's allowance and the sixth real donor would be turned away,
 * and a crawler on the site could use up the site's own allowance and have
 * Strapi refuse its page renders. Skip the per-IP bucket in that case and
 * lean on whatever other key the caller has.
 */
export function isInternalAddress(
  ip: string,
  raw = process.env.INTERNAL_NETWORKS,
): boolean {
  // An IPv4 address as an IPv6 socket reports it.
  const address = ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
  const version = isIP(address);
  if (version === 0) return false;
  if (!internal || internal.raw !== raw) {
    internal = {
      raw,
      networks: parseNetworks([...PRIVATE_NETWORKS, ...configuredNetworks(raw)])
        .networks,
    };
  }
  return internal.networks.check(address, version === 4 ? "ipv4" : "ipv6");
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

  /** The keys it's counting now, for tests. */
  trackedKeys(): string[] {
    return [...this.buckets.keys()];
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now > bucket.resetAt) this.buckets.delete(key);
    }
  }
}
