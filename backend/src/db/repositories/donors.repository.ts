import {
  EMAIL_PREFERENCES,
  type EmailPreference,
  type EmailPreferences,
} from "../../utils/email-preferences";
import { estonianDate, estonianMidnight } from "../../utils/estonian-time";
import { addressOf, addressWants } from "../../utils/address";
import { toLocale, type Locale } from "../../utils/locale";
import {
  eq,
  or,
  asc,
  desc,
  and,
  sql,
  ilike,
  gte,
  inArray,
  lt,
  isNull,
  isNotNull,
  type SQL,
} from "drizzle-orm";
import { db, type Database } from "../client";
import {
  donors,
  donations,
  recurringDonations,
  type Donor,
  type NewDonor,
} from "../schema";

/** Which emails an address gets, from all the donor rows that have it. */
export interface AddressEmailPreferences {
  newsletter: boolean;
  transferEmails: boolean;
  yearlyEmails: boolean;
  /** The language chosen for them, or null for the one last given in. */
  emailLocale: Locale | null;
  newsletterSource: string;
  emailPreferencesUpdatedAt: Date | null;
}
import {
  recurringDonationStatus,
  recurringActivityCutoff,
} from "./recurring-activity";

export type RecurringStatus = "new" | "retained" | "churned" | "churnedAllTime";

/**
 * [priorStart, refStart, refEnd) — the last complete calendar month (`ref`)
 * and the month immediately before it (`prior`), in Estonian time. Fixed reference window
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
  const { year, month } = estonianDate(now);
  return {
    priorStart: estonianMidnight(year, month - 2),
    refStart: estonianMidnight(year, month - 1),
    refEnd: estonianMidnight(year, month),
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
   * A new donor row. One with an address that has rows already gets the
   * address's email settings, as sending decides them: the rows that gave
   * decide once one has, so a new row with every email on would turn back
   * on what was turned off before the address first gave.
   */
  async create(data: Partial<NewDonor> & { email: string }): Promise<Donor> {
    const address = data.email.trim()
      ? await this.addressPreferences(
          sql`${addressOf(donors.email)} = ${addressOf(sql`${data.email}`)}`,
        )
      : undefined;
    const [donor] = await this.database
      .insert(donors)
      .values({
        idCode: data.idCode || null,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email,
        ...address,
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
   * Change which of the emails besides confirmations a donor gets. Emails go
   * to addresses, not donor rows, and one person can have more than one row
   * (a gift without an ID code, then one with it), so the change applies to
   * every row with the donor's address, in any letter case. Rows that
   * already have it so are left as they are, so saving the same choices
   * again doesn't count as the donor changing their emails.
   *
   * A newsletter setting given here stands over a "yes" from the donation
   * form still waiting to count. The settings page gives only what was
   * changed on it, so a change to other emails isn't one to the newsletter.
   * Turning the newsletter off here is the donor's own choice even where
   * it's off already, as from a donation, as by the unsubscribe button in
   * a newsletter: only such a choice keeps a later donation's "yes" from
   * turning it back on.
   */
  async updateEmailPreferences(
    id: number,
    preferences: EmailPreferences,
  ): Promise<Donor | undefined> {
    if (typeof preferences.newsletter === "boolean") {
      await this.cancelWaitingNewsletterChoices(id);
    }
    const differs = EMAIL_PREFERENCES.flatMap((preference) => {
      const value = preferences[preference];
      return typeof value === "boolean"
        ? [sql`${donors[preference]} IS DISTINCT FROM ${value}`]
        : [];
    });
    if (preferences.emailLocale !== undefined) {
      differs.push(
        sql`${donors.emailLocale} IS DISTINCT FROM ${preferences.emailLocale}`,
      );
    }
    if (preferences.newsletter === false) {
      differs.push(sql`${donors.newsletterSource} IS DISTINCT FROM 'settings'`);
    }
    if (differs.length > 0) {
      const now = new Date();
      await this.database
        .update(donors)
        .set({
          ...preferences,
          ...(typeof preferences.newsletter === "boolean" && {
            newsletterSource: "settings",
          }),
          emailPreferencesUpdatedAt: now,
          updatedAt: now,
        })
        .where(and(or(eq(donors.id, id), sameAddressAs(id)), or(...differs)));
    }
    return this.findById(id);
  }

  /**
   * Which emails a donor's address gets, as sending decides it: an email
   * goes to an address only if every row of it that has given wants that
   * kind, so one row with it off is enough. Rows that never gave count only
   * when none has. Also who set the newsletter as it is, and when anything
   * last changed. Undefined when there's no such donor.
   */
  async findEmailPreferences(
    id: number,
  ): Promise<AddressEmailPreferences | undefined> {
    return this.addressPreferences(or(eq(donors.id, id), sameAddressAs(id)));
  }

  /** findEmailPreferences, for the donor rows `rows` picks. */
  private async addressPreferences(
    rows: SQL | undefined,
  ): Promise<AddressEmailPreferences | undefined> {
    const gave = sql`EXISTS (SELECT 1 FROM ${donations} dn
      WHERE dn.donor_id = ${donors.id} AND dn.finalized)`;
    const wants = (column: (typeof donors)[EmailPreference]) =>
      addressWants(column, gave);
    // Who set the newsletter as the address has it: if it's off, a row
    // that's off, since that's what turns it off; the latest set of those.
    const newsletterSource = (rows: SQL) =>
      sql`(array_agg(${donors.newsletterSource} ORDER BY ${donors.newsletter},
        ${donors.emailPreferencesUpdatedAt} DESC NULLS LAST, ${donors.id} DESC)
        FILTER (WHERE ${rows}))[1]`;
    const [row] = await this.database
      .select({
        rows: sql<number>`cast(count(*) as int)`,
        newsletter: wants(donors.newsletter),
        transferEmails: wants(donors.transferEmails),
        yearlyEmails: wants(donors.yearlyEmails),
        // A change sets every row of the address; should they differ, the
        // latest choice counts.
        emailLocale: sql<string | null>`(array_agg(${donors.emailLocale}
          ORDER BY ${donors.emailPreferencesUpdatedAt} DESC NULLS LAST, ${donors.id} DESC)
          FILTER (WHERE ${donors.emailLocale} IS NOT NULL))[1]`,
        newsletterSource: sql<string>`coalesce(${newsletterSource(gave)}, ${newsletterSource(sql`true`)})`,
        emailPreferencesUpdatedAt:
          sql<Date | null>`max(${donors.emailPreferencesUpdatedAt})`.mapWith(
            donors.emailPreferencesUpdatedAt,
          ),
      })
      .from(donors)
      .where(rows);
    if (!row || row.rows === 0) return undefined;
    const { rows: _, emailLocale, ...preferences } = row;
    return {
      ...preferences,
      emailLocale: emailLocale ? toLocale(emailLocale) : null,
    };
  }

  /**
   * Cancel the "yes" to the newsletter still waiting at a donor's address for
   * money to arrive: a standing order's, for its first payment, and an
   * unpaid donation's. A choice made since stands over them.
   */
  private async cancelWaitingNewsletterChoices(id: number): Promise<void> {
    const address = this.database
      .select({ id: donors.id })
      .from(donors)
      .where(or(eq(donors.id, id), sameAddressAs(id)));
    await this.database
      .update(recurringDonations)
      .set({ newsletter: null })
      .where(
        and(
          inArray(recurringDonations.donorId, address),
          eq(recurringDonations.newsletter, true),
        ),
      );
    await this.database
      .update(donations)
      .set({ newsletter: null })
      .where(
        and(
          inArray(donations.donorId, address),
          eq(donations.finalized, false),
          eq(donations.newsletter, true),
        ),
      );
  }

  /**
   * Set whether a donor's address gets the newsletter, as chosen on the
   * donation form. Rows that already have it so are left as they are, so a
   * donation that changes nothing doesn't count as the donor changing their
   * emails. How many rows changed.
   *
   * A "no" counts when it's made: it only ever stops emails, so it needs no
   * payment, and it cancels any "yes" still waiting. A "yes" counts once
   * money arrives, unless the newsletter was set since: every way of setting
   * it cancels the "yes" waiting. And anyone can fill in the form with
   * someone else's address, so a "yes" never turns the newsletter back on
   * for an address where it was turned off in the settings: only the
   * settings can.
   */
  async setNewsletter(id: number, newsletter: boolean): Promise<number> {
    if (!newsletter) await this.cancelWaitingNewsletterChoices(id);
    const now = new Date();
    const rows = await this.database
      .update(donors)
      .set({
        newsletter,
        newsletterSource: "donation",
        emailPreferencesUpdatedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          or(eq(donors.id, id), sameAddressAs(id)),
          sql`${donors.newsletter} IS DISTINCT FROM ${newsletter}`,
          // A row turned off in the settings stays off, and so does the
          // address, since every row of it has to want the newsletter. In
          // the update itself, so an unsubscribe landing at the same moment
          // is seen.
          newsletter
            ? sql`NOT (${donors.newsletter} = false AND ${donors.newsletterSource} = 'settings')`
            : undefined,
        ),
      )
      .returning({ id: donors.id });
    return rows.length;
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

    const recurringCutoff = recurringActivityCutoff();
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
   * donations. `recurringDonor`, and each recurring donation's `status`, are
   * computed the same payment-based way `findPaginated` and the recurring
   * donations pages do (see RECURRING_ACTIVITY_WINDOW_DAYS) — in JS here, from
   * the `donations` already fetched, instead of a second DB query.
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

    const recurringCutoff = recurringActivityCutoff();
    const recurringDonor = donor.donations.some(
      (d) =>
        d.finalized &&
        d.recurringDonationId !== null &&
        new Date(d.datetime) >= recurringCutoff,
    );

    // A recurring donation's payments are made by its own donor, so this
    // donor's donations hold every donation linked to it.
    const recurringDonations = donor.recurringDonations.map((rd) => ({
      ...rd,
      status: recurringDonationStatus(
        donor.donations.filter((d) => d.recurringDonationId === rd.id),
      ),
    }));

    return { ...donor, recurringDonations, recurringDonor };
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

/**
 * The donors with the same email address as donor `id`, in any letter case
 * and ignoring spaces around it; none when it has no address.
 */
function sameAddressAs(id: number) {
  return sql`${addressOf(donors.email)} = (
    SELECT nullif(${addressOf(sql.raw("d.email"))}, '') FROM donors d WHERE d.id = ${id}
  )`;
}

export const donorsRepository = new DonorsRepository();
