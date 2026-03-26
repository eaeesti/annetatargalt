import { eq, sql, and, gte, isNotNull } from "drizzle-orm";
import { db, type Database } from "../client";
import { donations, donors, recurringDonations } from "../schema";

export type PeriodStats = {
  total: number;
  count: number;
};

export type DashboardStats = {
  /** Count + sum of all finalized donations */
  totalDonations: { count: number; sum: number };
  /** Unique donors with at least one finalized donation */
  totalDonors: number;
  /** Unique donors with a finalized donation in the last 12 months */
  activeDonors: number;
  /** Sum of active recurring donation amounts (cents/month) */
  mrr: number;
  /** Rolling period comparisons: current period vs prior period of same length */
  periods: {
    days30: { current: PeriodStats; prior: PeriodStats };
    days90: { current: PeriodStats; prior: PeriodStats };
    days365: { current: PeriodStats; prior: PeriodStats };
  };
};

export class DashboardRepository {
  constructor(private database: Database = db) {}

  /** Count + sum of all finalized donations. */
  async getTotalDonations(): Promise<{ count: number; sum: number }> {
    const [row] = await this.database
      .select({
        count: sql<number>`cast(count(*) as int)`,
        sum: sql<number>`cast(coalesce(sum(${donations.amount}), 0) as int)`,
      })
      .from(donations)
      .where(eq(donations.finalized, true));
    return { count: row?.count ?? 0, sum: row?.sum ?? 0 };
  }

  /** Count of distinct donors with at least one finalized donation. */
  async getTotalDonors(): Promise<number> {
    const [row] = await this.database
      .select({
        count: sql<number>`cast(count(distinct ${donations.donorId}) as int)`,
      })
      .from(donations)
      .where(and(eq(donations.finalized, true), isNotNull(donations.donorId)));
    return row?.count ?? 0;
  }

  /** Count of distinct donors with a finalized donation in the last 12 months. */
  async getActiveDonors(): Promise<number> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const [row] = await this.database
      .select({
        count: sql<number>`cast(count(distinct ${donations.donorId}) as int)`,
      })
      .from(donations)
      .where(
        and(
          eq(donations.finalized, true),
          isNotNull(donations.donorId),
          gte(donations.datetime, cutoff),
        ),
      );
    return row?.count ?? 0;
  }

  /** Sum of amounts across all active recurring donations (cents/month). */
  async getMrr(): Promise<number> {
    const [row] = await this.database
      .select({
        total: sql<number>`cast(coalesce(sum(${recurringDonations.amount}), 0) as int)`,
      })
      .from(recurringDonations)
      .where(eq(recurringDonations.active, true));
    return row?.total ?? 0;
  }

  /** Sum + count of finalized donations within [from, to). */
  async getPeriodStats(from: Date, to: Date): Promise<PeriodStats> {
    const [row] = await this.database
      .select({
        count: sql<number>`cast(count(*) as int)`,
        total: sql<number>`cast(coalesce(sum(${donations.amount}), 0) as int)`,
      })
      .from(donations)
      .where(
        and(
          eq(donations.finalized, true),
          gte(donations.datetime, from),
          sql`${donations.datetime} < ${to}`,
        ),
      );
    return { count: row?.count ?? 0, total: row?.total ?? 0 };
  }

  /** Fetch all dashboard stats in parallel. */
  async getStats(): Promise<DashboardStats> {
    const now = new Date();

    const d = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      return d;
    };

    const [
      totalDonations,
      totalDonors,
      activeDonors,
      mrr,
      p30c,
      p30p,
      p90c,
      p90p,
      p365c,
      p365p,
    ] = await Promise.all([
      this.getTotalDonations(),
      this.getTotalDonors(),
      this.getActiveDonors(),
      this.getMrr(),
      this.getPeriodStats(d(30), now),
      this.getPeriodStats(d(60), d(30)),
      this.getPeriodStats(d(90), now),
      this.getPeriodStats(d(180), d(90)),
      this.getPeriodStats(d(365), now),
      this.getPeriodStats(d(730), d(365)),
    ]);

    return {
      totalDonations,
      totalDonors,
      activeDonors,
      mrr,
      periods: {
        days30: { current: p30c, prior: p30p },
        days90: { current: p90c, prior: p90p },
        days365: { current: p365c, prior: p365p },
      },
    };
  }
}

export const dashboardRepository = new DashboardRepository();
