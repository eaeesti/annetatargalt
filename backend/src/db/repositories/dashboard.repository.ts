import { eq, sql, and, gte, isNotNull } from "drizzle-orm";
import { db, type Database } from "../client";
import { donations, recurringDonations } from "../schema";

export type PeriodStats = {
  total: number;
  count: number;
};

export type MonthlyTotalsRow = {
  month: string; // "YYYY-MM"
  total: number; // sum of amounts in cents
  count: number;
  avgAmount: number; // average amount in cents
};

export type ActiveDonorsRow = {
  month: string; // "YYYY-MM"
  activeDonors: number; // distinct donors with ≥1 finalized donation in trailing 12 months
};

export type RecurringChurnRow = {
  month: string; // "YYYY-MM"
  active: number; // donors with a recurring donation payment this month
  newDonors: number; // appeared this month, not last
  churned: number; // appeared last month, not this month
};

export type DashboardCharts = {
  monthlyTotals: MonthlyTotalsRow[];
  activeDonorsPerMonth: ActiveDonorsRow[];
  recurringChurn: RecurringChurnRow[];
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

  /** Monthly donation totals, counts, and averages — all time, ascending. */
  async getMonthlyTotals(): Promise<MonthlyTotalsRow[]> {
    const result = await this.database.execute(sql`
      SELECT
        to_char(datetime, 'YYYY-MM') AS month,
        cast(sum(amount) as int)     AS total,
        cast(count(*) as int)        AS count,
        cast(avg(amount) as int)     AS avg_amount
      FROM donations
      WHERE finalized = true
      GROUP BY to_char(datetime, 'YYYY-MM')
      ORDER BY month ASC
    `);
    return (result.rows as Array<Record<string, unknown>>).map((r) => ({
      month: r.month as string,
      total: Number(r.total),
      count: Number(r.count),
      avgAmount: Number(r.avg_amount),
    }));
  }

  /**
   * For each of the last 24 months: count distinct donors with ≥1 finalized
   * donation in the trailing 12-month window ending that month (inclusive).
   */
  async getActiveDonorsPerMonth(): Promise<ActiveDonorsRow[]> {
    const result = await this.database.execute(sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '23 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS month
      )
      SELECT
        to_char(m.month, 'YYYY-MM') AS month,
        cast(count(distinct d.donor_id) as int) AS active_donors
      FROM months m
      LEFT JOIN donations d
        ON  d.finalized  = true
        AND d.donor_id   IS NOT NULL
        AND d.datetime  >= m.month - interval '11 months'
        AND d.datetime   < m.month  + interval '1 month'
      GROUP BY m.month
      ORDER BY m.month ASC
    `);
    return (result.rows as Array<Record<string, unknown>>).map((r) => ({
      month: r.month as string,
      activeDonors: Number(r.active_donors),
    }));
  }

  /**
   * For each of the last 24 months: count recurring-linked donor payments,
   * plus donors who are new (not in prior month) and churned (in prior month
   * but not this month).
   */
  async getRecurringChurn(): Promise<RecurringChurnRow[]> {
    const result = await this.database.execute(sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '23 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS month
      ),
      monthly_active AS (
        SELECT
          date_trunc('month', d.datetime) AS month,
          d.donor_id
        FROM donations d
        WHERE d.finalized              = true
          AND d.donor_id               IS NOT NULL
          AND d.recurring_donation_id  IS NOT NULL
        GROUP BY date_trunc('month', d.datetime), d.donor_id
      )
      SELECT
        to_char(m.month, 'YYYY-MM') AS month,
        cast(coalesce((
          SELECT count(distinct ma.donor_id)
          FROM monthly_active ma WHERE ma.month = m.month
        ), 0) as int) AS active,
        cast(coalesce((
          SELECT count(distinct ma.donor_id)
          FROM monthly_active ma
          WHERE ma.month = m.month
            AND ma.donor_id NOT IN (
              SELECT ma2.donor_id FROM monthly_active ma2
              WHERE ma2.month = m.month - interval '1 month'
            )
        ), 0) as int) AS new_donors,
        cast(coalesce((
          SELECT count(distinct ma.donor_id)
          FROM monthly_active ma
          WHERE ma.month = m.month - interval '1 month'
            AND ma.donor_id NOT IN (
              SELECT ma2.donor_id FROM monthly_active ma2
              WHERE ma2.month = m.month
            )
        ), 0) as int) AS churned
      FROM months m
      ORDER BY m.month ASC
    `);
    return (result.rows as Array<Record<string, unknown>>).map((r) => ({
      month: r.month as string,
      active: Number(r.active),
      newDonors: Number(r.new_donors),
      churned: Number(r.churned),
    }));
  }

  /** Fetch all chart series in parallel. */
  async getCharts(): Promise<DashboardCharts> {
    const [monthlyTotals, activeDonorsPerMonth, recurringChurn] =
      await Promise.all([
        this.getMonthlyTotals(),
        this.getActiveDonorsPerMonth(),
        this.getRecurringChurn(),
      ]);
    return { monthlyTotals, activeDonorsPerMonth, recurringChurn };
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
