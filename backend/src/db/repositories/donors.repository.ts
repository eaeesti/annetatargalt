import {
  eq,
  or,
  asc,
  desc,
  and,
  sql,
  ilike,
  gte,
  lt,
  isNull,
  isNotNull,
} from "drizzle-orm";
import { db, type Database } from "../client";
import { donors, donations, type Donor, type NewDonor } from "../schema";
import { RECURRING_ACTIVITY_WINDOW_DAYS } from "./recurring-activity";

export type RecurringStatus = "new" | "retained" | "churned" | "churnedAllTime";

/**
 * [priorStart, refStart, refEnd) — the last complete calendar month (`ref`)
 * and the month immediately before it (`prior`), UTC. Fixed reference window
 * for the `recurringStatus` filter below: "new"/"retained"/"churned" as of
 * last month, the same per-donor definition
 * DashboardRepository.getRecurringChurn uses per-cohort (finalized donation
 * tied to a recurring donation, one calendar month vs. the one before it).
 */
export function lastCompleteMonthRange(now: Date = new Date()): {
  priorStart: Date;
  refStart: Date;
  refEnd: Date;
} {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    priorStart: new Date(Date.UTC(y, m - 2, 1)),
    refStart: new Date(Date.UTC(y, m - 1, 1)),
    refEnd: new Date(Date.UTC(y, m, 1)),
  };
}

export class DonorsRepository {
  constructor(private database: Database = db) {}

  /**
   * Find all donors (for export)
   */
  async findAll(): Promise<Donor[]> {
    return this.database.query.donors.findMany({
      orderBy: (donors, { asc }) => [asc(donors.id)],
    });
  }

  /**
   * Find a donor by ID
   */
  async findById(id: number): Promise<Donor | undefined> {
    return this.database.query.donors.findFirst({
      where: eq(donors.id, id),
    });
  }

  /**
   * Find a donor by ID code
   */
  async findByIdCode(idCode: string): Promise<Donor | undefined> {
    return this.database.query.donors.findFirst({
      where: eq(donors.idCode, idCode),
    });
  }

  /**
   * Find a donor by email
   */
  async findByEmail(email: string): Promise<Donor | undefined> {
    return this.database.query.donors.findFirst({
      where: eq(donors.email, email),
    });
  }

  /**
   * Find a donor by ID code or email
   */
  async findByIdCodeOrEmail(
    idCode: string | null,
    email: string,
  ): Promise<Donor | undefined> {
    if (idCode) {
      return this.database.query.donors.findFirst({
        where: or(eq(donors.idCode, idCode), eq(donors.email, email)),
      });
    }
    return this.findByEmail(email);
  }

  /**
   * Create a new donor
   */
  async create(data: Partial<NewDonor> & { email: string }): Promise<Donor> {
    const [donor] = await this.database
      .insert(donors)
      .values({
        idCode: data.idCode || null,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email,
      })
      .returning();
    if (!donor) throw new Error("Failed to insert donor");
    return donor;
  }

  /**
   * Update a donor
   */
  async update(
    id: number,
    data: Partial<NewDonor>,
  ): Promise<Donor | undefined> {
    const [donor] = await this.database
      .update(donors)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(donors.id, id))
      .returning();
    return donor;
  }

  /**
   * Paginated, sortable, filterable donors list for the admin panel.
   * Includes computed columns: totalDonated, donationCount, lastDonationDate
   * from finalized donations.
   */
  async findPaginated(options: {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    recurringDonor?: boolean;
    recurringStatus?: RecurringStatus;
    search?: string;
  }) {
    const { page, pageSize, sortBy = "id", sortDir = "asc" } = options;

    // Subquery: per-donor stats from finalized donations only
    const statsSq = this.database
      .select({
        donorId: donations.donorId,
        totalDonated:
          sql<number>`cast(coalesce(sum(${donations.amount}), 0) as int)`.as(
            "total_donated",
          ),
        donationCount: sql<number>`cast(count(*) as int)`.as("donation_count"),
        lastDonationDate: sql<string | null>`max(${donations.datetime})`.as(
          "last_donation_date",
        ),
      })
      .from(donations)
      .where(eq(donations.finalized, true))
      .groupBy(donations.donorId)
      .as("ds");

    const recurringCutoff = new Date();
    recurringCutoff.setDate(
      recurringCutoff.getDate() - RECURRING_ACTIVITY_WINDOW_DAYS,
    );
    const recurringSq = this.database
      .select({ donorId: donations.donorId })
      .from(donations)
      .where(
        and(
          eq(donations.finalized, true),
          isNotNull(donations.recurringDonationId),
          gte(donations.datetime, recurringCutoff),
        ),
      )
      .groupBy(donations.donorId)
      .as("rs");

    // Donors with a finalized, recurring-linked donation at any point, ever —
    // no date bound. Paired with recurringSq (currently active, above) for
    // the "churnedAllTime" status below: ever recurring, but not within the
    // 60-day window, regardless of when they stopped.
    const everRecurringSq = this.database
      .select({ donorId: donations.donorId })
      .from(donations)
      .where(
        and(
          eq(donations.finalized, true),
          isNotNull(donations.recurringDonationId),
        ),
      )
      .groupBy(donations.donorId)
      .as("er");

    // Subqueries: donors active (finalized, recurring-linked donation) in the
    // last complete calendar month and in the month before that — the pair
    // behind the `recurringStatus` filter (new/retained/churned as of last
    // month). Separate from recurringSq above: that's a 60-day rolling
    // window, this is a fixed calendar-month cohort comparison, and the two
    // can legitimately disagree near the boundary.
    const { priorStart, refStart, refEnd } = lastCompleteMonthRange();
    const statusThisSq = this.database
      .select({ donorId: donations.donorId })
      .from(donations)
      .where(
        and(
          eq(donations.finalized, true),
          isNotNull(donations.recurringDonationId),
          gte(donations.datetime, refStart),
          lt(donations.datetime, refEnd),
        ),
      )
      .groupBy(donations.donorId)
      .as("st");
    const statusPriorSq = this.database
      .select({ donorId: donations.donorId })
      .from(donations)
      .where(
        and(
          eq(donations.finalized, true),
          isNotNull(donations.recurringDonationId),
          gte(donations.datetime, priorStart),
          lt(donations.datetime, refStart),
        ),
      )
      .groupBy(donations.donorId)
      .as("sp");

    const conditions = [];
    if (options.recurringDonor !== undefined) {
      conditions.push(
        options.recurringDonor
          ? isNotNull(recurringSq.donorId)
          : isNull(recurringSq.donorId),
      );
    }
    if (options.recurringStatus) {
      const thisActive = isNotNull(statusThisSq.donorId);
      const priorActive = isNotNull(statusPriorSq.donorId);
      if (options.recurringStatus === "new") {
        conditions.push(and(thisActive, isNull(statusPriorSq.donorId)));
      } else if (options.recurringStatus === "retained") {
        conditions.push(and(thisActive, priorActive));
      } else if (options.recurringStatus === "churned") {
        conditions.push(and(isNull(statusThisSq.donorId), priorActive));
      } else {
        // churnedAllTime: had a recurring-linked payment at some point, but
        // not within the current 60-day window — regardless of when they
        // stopped (not tied to last month specifically, unlike "churned").
        conditions.push(
          and(isNotNull(everRecurringSq.donorId), isNull(recurringSq.donorId)),
        );
      }
    }
    if (options.search) {
      const term = `%${options.search}%`;
      conditions.push(
        or(
          ilike(donors.firstName, term),
          ilike(donors.lastName, term),
          ilike(donors.email, term),
        ),
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const d = sortDir === "asc" ? asc : desc;
    const orderByClause = (() => {
      switch (sortBy) {
        case "lastName":
          return d(donors.lastName);
        case "email":
          return d(donors.email);
        case "recurringDonor":
          return d(sql`(${recurringSq.donorId} is not null)`);
        case "totalDonated":
          return d(sql`coalesce(${statsSq.totalDonated}, 0)`);
        case "donationCount":
          return d(sql`coalesce(${statsSq.donationCount}, 0)`);
        case "lastDonationDate":
          return sortDir === "desc"
            ? sql`${statsSq.lastDonationDate} desc nulls last`
            : sql`${statsSq.lastDonationDate} asc nulls last`;
        default:
          return d(donors.id);
      }
    })();

    const selectFields = {
      id: donors.id,
      firstName: donors.firstName,
      lastName: donors.lastName,
      email: donors.email,
      idCode: donors.idCode,
      recurringDonor: sql<boolean>`(${recurringSq.donorId} is not null)`,
      createdAt: donors.createdAt,
      totalDonated: sql<number>`coalesce(${statsSq.totalDonated}, 0)`,
      donationCount: sql<number>`coalesce(${statsSq.donationCount}, 0)`,
      lastDonationDate: statsSq.lastDonationDate,
    };

    const [data, countResult] = await Promise.all([
      this.database
        .select(selectFields)
        .from(donors)
        .leftJoin(statsSq, eq(donors.id, statsSq.donorId))
        .leftJoin(recurringSq, eq(donors.id, recurringSq.donorId))
        .leftJoin(everRecurringSq, eq(donors.id, everRecurringSq.donorId))
        .leftJoin(statusThisSq, eq(donors.id, statusThisSq.donorId))
        .leftJoin(statusPriorSq, eq(donors.id, statusPriorSq.donorId))
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.database
        .select({ total: sql<number>`cast(count(*) as int)` })
        .from(donors)
        .leftJoin(recurringSq, eq(donors.id, recurringSq.donorId))
        .leftJoin(everRecurringSq, eq(donors.id, everRecurringSq.donorId))
        .leftJoin(statusThisSq, eq(donors.id, statusThisSq.donorId))
        .leftJoin(statusPriorSq, eq(donors.id, statusPriorSq.donorId))
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.total ?? 0 };
  }

  /**
   * Find a donor by ID with all their donations (and org splits) and recurring
   * donations. `recurringDonor` is computed the same payment-based way
   * `findPaginated` does (see RECURRING_ACTIVITY_WINDOW_DAYS) — in JS here,
   * from the `donations` already fetched, instead of a second DB query.
   */
  async findByIdWithDonations(id: number) {
    const donor = await this.database.query.donors.findFirst({
      where: eq(donors.id, id),
      with: {
        donations: {
          orderBy: [desc(donations.datetime)],
          with: { organizationDonations: true },
        },
        recurringDonations: true,
      },
    });
    if (!donor) return undefined;

    const recurringCutoff = new Date();
    recurringCutoff.setDate(
      recurringCutoff.getDate() - RECURRING_ACTIVITY_WINDOW_DAYS,
    );
    const recurringDonor = donor.donations.some(
      (d) =>
        d.finalized &&
        d.recurringDonationId !== null &&
        new Date(d.datetime) >= recurringCutoff,
    );

    return { ...donor, recurringDonor };
  }

  /**
   * Find or create a donor by ID code or email
   */
  async findOrCreate(
    data: Partial<NewDonor> & { email: string },
  ): Promise<Donor> {
    const existing = await this.findByIdCodeOrEmail(
      data.idCode || null,
      data.email,
    );
    if (existing) {
      return existing;
    }
    return this.create(data);
  }
}

export const donorsRepository = new DonorsRepository();
