import { sql, type SQL } from "drizzle-orm";
import { db, type Database } from "../client";

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
  /**
   * What finalized donations gave Anneta Targalt itself (its support
   * organization): the donations it's in, and the sum. Kept apart from
   * `totalDonations`, which leaves it out.
   */
  support: { count: number; sum: number };
  /** Unique donors with at least one finalized donation */
  totalDonors: number;
  /** Unique donors with a finalized donation in the last 12 months */
  activeDonors: number;
  /**
   * Sum of active recurring donation amounts (cents/month). Not "MRR" — this
   * money isn't Anneta Targalt's revenue, it's passed on to the recipient
   * organizations.
   */
  monthlyRecurringDonations: number;
  /**
   * Calendar-aligned period comparisons. Each period's `prior` is the
   * immediately preceding period of the same length (e.g. lastMonth.prior is
   * the month before last — not the same range as currentMonth.prior, which
   * is last month). `from` (UTC, start of the period) lets the caller label
   * the row with the actual month/quarter/year it covers.
   */
  periods: {
    currentMonth: { current: PeriodStats; prior: PeriodStats; from: string };
    lastMonth: { current: PeriodStats; prior: PeriodStats; from: string };
    currentQuarter: { current: PeriodStats; prior: PeriodStats; from: string };
    lastQuarter: { current: PeriodStats; prior: PeriodStats; from: string };
    currentYear: { current: PeriodStats; prior: PeriodStats; from: string };
    lastYear: { current: PeriodStats; prior: PeriodStats; from: string };
  };
};

type DateRange = [from: Date, to: Date];

/** [start, end) of the calendar month `monthsAgo` months before `now`, UTC. */
export function monthRange(now: Date, monthsAgo: number): DateRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() - monthsAgo;
  return [new Date(Date.UTC(y, m, 1)), new Date(Date.UTC(y, m + 1, 1))];
}

/** [start, end) of the calendar quarter `quartersAgo` quarters before `now`, UTC. */
export function quarterRange(now: Date, quartersAgo: number): DateRange {
  const y = now.getUTCFullYear();
  const q = Math.floor(now.getUTCMonth() / 3) - quartersAgo;
  return [new Date(Date.UTC(y, q * 3, 1)), new Date(Date.UTC(y, q * 3 + 3, 1))];
}

/** [start, end) of the calendar year `yearsAgo` years before `now`, UTC. */
export function yearRange(now: Date, yearsAgo: number): DateRange {
  const y = now.getUTCFullYear() - yearsAgo;
  return [new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y + 1, 0, 1))];
}

/** Whether `column`, an organization's internal ID, is one of `excluded`. */
function isExcluded(column: SQL, excluded: string[]): SQL {
  if (excluded.length === 0) return sql`false`;
  return sql`${column} IN (${sql.join(
    excluded.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

/**
 * The finalized donations the dashboard counts, as a table to select from:
 * each one's amount less what it gave to the `excluded` organizations, and
 * none that gave only to those.
 */
function countedDonations(excluded: string[]): SQL {
  return sql`(
    SELECT d.id, d.donor_id, d.datetime, d.recurring_donation_id,
      d.amount - cast(coalesce(sum(od.amount), 0) as int) AS amount
    FROM donations d
    LEFT JOIN organization_donations od
      ON od.donation_id = d.id
      AND ${isExcluded(sql`od.organization_internal_id`, excluded)}
    WHERE d.finalized = true
    GROUP BY d.id
    HAVING d.amount > coalesce(sum(od.amount), 0)
  )`;
}

/**
 * The numbers on the dashboard. Every method takes the organizations to
 * leave out (`excluded`): what's given to them isn't donations passed on by
 * Anneta Targalt. That's the external one, whose donations it only passes
 * on, and Anneta Targalt's own support organization, which the dashboard
 * shows apart. Their share of a donation isn't counted, and a donation that
 * went only to them isn't counted at all.
 */
export class DashboardRepository {
  constructor(private database: Database = db) {}

  /** The donations an organization got a share of, and what the shares add up to. */
  async getOrganizationTotal(
    organizationInternalId: string,
  ): Promise<{ count: number; sum: number }> {
    const result = await this.database.execute<{
      count: number;
      sum: number;
    }>(sql`
      SELECT cast(count(*) as int) AS count,
        cast(coalesce(sum(od.amount), 0) as int) AS sum
      FROM organization_donations od
      JOIN donations d ON d.id = od.donation_id
      WHERE d.finalized = true
        AND od.organization_internal_id = ${organizationInternalId}
    `);
    const row = result.rows[0];
    return { count: row?.count ?? 0, sum: row?.sum ?? 0 };
  }

  /** Count + sum of all finalized donations. */
  async getTotalDonations(
    excluded: string[] = [],
  ): Promise<{ count: number; sum: number }> {
    const result = await this.database.execute<{
      count: number;
      sum: number;
    }>(sql`
      SELECT cast(count(*) as int) AS count,
        cast(coalesce(sum(c.amount), 0) as int) AS sum
      FROM ${countedDonations(excluded)} c
    `);
    const row = result.rows[0];
    return { count: row?.count ?? 0, sum: row?.sum ?? 0 };
  }

  /** Count of distinct donors with at least one finalized donation. */
  async getTotalDonors(excluded: string[] = []): Promise<number> {
    const result = await this.database.execute<{ count: number }>(sql`
      SELECT cast(count(distinct c.donor_id) as int) AS count
      FROM ${countedDonations(excluded)} c
      WHERE c.donor_id IS NOT NULL
    `);
    return result.rows[0]?.count ?? 0;
  }

  /** Count of distinct donors with a finalized donation in the last 12 months. */
  async getActiveDonors(excluded: string[] = []): Promise<number> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const result = await this.database.execute<{ count: number }>(sql`
      SELECT cast(count(distinct c.donor_id) as int) AS count
      FROM ${countedDonations(excluded)} c
      WHERE c.donor_id IS NOT NULL
        AND c.datetime >= ${cutoff.toISOString()}
    `);
    return result.rows[0]?.count ?? 0;
  }

  /**
   * Sum of amounts for recurring donations that had a finalized payment in the
   * last 60 days — see RECURRING_ACTIVITY_WINDOW_DAYS.
   */
  async getMonthlyRecurringDonations(excluded: string[] = []): Promise<number> {
    const result = await this.database.execute(sql`
      SELECT cast(coalesce(sum(r.amount), 0) as int) AS total
      FROM (
        SELECT rd.amount - coalesce(sum(ord.amount), 0) AS amount
        FROM recurring_donations rd
        LEFT JOIN organization_recurring_donations ord
          ON ord.recurring_donation_id = rd.id
          AND ${isExcluded(sql`ord.organization_internal_id`, excluded)}
        WHERE EXISTS (
          SELECT 1 FROM donations d
          WHERE d.recurring_donation_id = rd.id
            AND d.finalized = true
            AND d.datetime >= now() - interval '60 days'
        )
        GROUP BY rd.id
      ) r
    `);
    return Number(result.rows[0]?.total ?? 0);
  }

  /** Sum + count of finalized donations within [from, to). */
  async getPeriodStats(
    from: Date,
    to: Date,
    excluded: string[] = [],
  ): Promise<PeriodStats> {
    const result = await this.database.execute<PeriodStats>(sql`
      SELECT cast(count(*) as int) AS count,
        cast(coalesce(sum(c.amount), 0) as int) AS total
      FROM ${countedDonations(excluded)} c
      WHERE c.datetime >= ${from.toISOString()}
        AND c.datetime < ${to.toISOString()}
    `);
    const row = result.rows[0];
    return { count: row?.count ?? 0, total: row?.total ?? 0 };
  }

  /** Monthly donation totals, counts, and averages — all time, ascending. */
  async getMonthlyTotals(excluded: string[] = []): Promise<MonthlyTotalsRow[]> {
    const result = await this.database.execute(sql`
      SELECT
        to_char(datetime, 'YYYY-MM') AS month,
        cast(sum(amount) as int)     AS total,
        cast(count(*) as int)        AS count,
        cast(avg(amount) as int)     AS avg_amount
      FROM ${countedDonations(excluded)} c
      GROUP BY to_char(datetime, 'YYYY-MM')
      ORDER BY month ASC
    `);
    return result.rows.map((r) => ({
      month: String(r.month),
      total: Number(r.total),
      count: Number(r.count),
      avgAmount: Number(r.avg_amount),
    }));
  }

  /**
   * For each of the last 24 months: count distinct donors with ≥1 finalized
   * donation in the trailing 12-month window ending that month (inclusive).
   */
  async getActiveDonorsPerMonth(
    excluded: string[] = [],
  ): Promise<ActiveDonorsRow[]> {
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
      LEFT JOIN ${countedDonations(excluded)} d
        ON  d.donor_id   IS NOT NULL
        AND d.datetime  >= m.month - interval '11 months'
        AND d.datetime   < m.month  + interval '1 month'
      GROUP BY m.month
      ORDER BY m.month ASC
    `);
    return result.rows.map((r) => ({
      month: String(r.month),
      activeDonors: Number(r.active_donors),
    }));
  }

  /**
   * For each of the last 24 months: count recurring-linked donor payments,
   * plus donors who are new (not in prior month) and churned (in prior month
   * but not this month).
   */
  async getRecurringChurn(
    excluded: string[] = [],
  ): Promise<RecurringChurnRow[]> {
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
        FROM ${countedDonations(excluded)} d
        WHERE d.donor_id               IS NOT NULL
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
    return result.rows.map((r) => ({
      month: String(r.month),
      active: Number(r.active),
      newDonors: Number(r.new_donors),
      churned: Number(r.churned),
    }));
  }

  /** Fetch all chart series in parallel. */
  async getCharts(excluded: string[] = []): Promise<DashboardCharts> {
    const [monthlyTotals, activeDonorsPerMonth, recurringChurn] =
      await Promise.all([
        this.getMonthlyTotals(excluded),
        this.getActiveDonorsPerMonth(excluded),
        this.getRecurringChurn(excluded),
      ]);
    return { monthlyTotals, activeDonorsPerMonth, recurringChurn };
  }

  /**
   * Fetch all dashboard stats in parallel. `supportOrganization` is Anneta
   * Targalt's own, whose total is given apart; it belongs in `excluded` too.
   */
  async getStats(
    excluded: string[] = [],
    supportOrganization?: string,
  ): Promise<DashboardStats> {
    const now = new Date();

    const month0Range = monthRange(now, 0);
    const month1Range = monthRange(now, 1);
    const month2Range = monthRange(now, 2);
    const quarter0Range = quarterRange(now, 0);
    const quarter1Range = quarterRange(now, 1);
    const quarter2Range = quarterRange(now, 2);
    const year0Range = yearRange(now, 0);
    const year1Range = yearRange(now, 1);
    const year2Range = yearRange(now, 2);

    const [
      totalDonations,
      support,
      totalDonors,
      activeDonors,
      monthlyRecurringDonations,
      month0,
      month1,
      month2,
      quarter0,
      quarter1,
      quarter2,
      year0,
      year1,
      year2,
    ] = await Promise.all([
      this.getTotalDonations(excluded),
      supportOrganization
        ? this.getOrganizationTotal(supportOrganization)
        : { count: 0, sum: 0 },
      this.getTotalDonors(excluded),
      this.getActiveDonors(excluded),
      this.getMonthlyRecurringDonations(excluded),
      this.getPeriodStats(...month0Range, excluded),
      this.getPeriodStats(...month1Range, excluded),
      this.getPeriodStats(...month2Range, excluded),
      this.getPeriodStats(...quarter0Range, excluded),
      this.getPeriodStats(...quarter1Range, excluded),
      this.getPeriodStats(...quarter2Range, excluded),
      this.getPeriodStats(...year0Range, excluded),
      this.getPeriodStats(...year1Range, excluded),
      this.getPeriodStats(...year2Range, excluded),
    ]);

    return {
      totalDonations,
      support,
      totalDonors,
      activeDonors,
      monthlyRecurringDonations,
      periods: {
        currentMonth: {
          current: month0,
          prior: month1,
          from: month0Range[0].toISOString(),
        },
        lastMonth: {
          current: month1,
          prior: month2,
          from: month1Range[0].toISOString(),
        },
        currentQuarter: {
          current: quarter0,
          prior: quarter1,
          from: quarter0Range[0].toISOString(),
        },
        lastQuarter: {
          current: quarter1,
          prior: quarter2,
          from: quarter1Range[0].toISOString(),
        },
        currentYear: {
          current: year0,
          prior: year1,
          from: year0Range[0].toISOString(),
        },
        lastYear: {
          current: year1,
          prior: year2,
          from: year1Range[0].toISOString(),
        },
      },
    };
  }
}

export const dashboardRepository = new DashboardRepository();
