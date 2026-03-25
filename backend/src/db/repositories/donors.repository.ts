import { eq, or, asc, desc, and, sql } from "drizzle-orm";
import { db, type Database } from "../client";
import { donors, donations, type Donor, type NewDonor } from "../schema";

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
        recurringDonor: data.recurringDonor || false,
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
   * Mark donor as recurring donor
   */
  async markAsRecurring(id: number): Promise<Donor | undefined> {
    return this.update(id, { recurringDonor: true });
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

    const conditions = [];
    if (options.recurringDonor !== undefined) {
      conditions.push(eq(donors.recurringDonor, options.recurringDonor));
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
          return d(donors.recurringDonor);
        case "totalDonated":
          return d(statsSq.totalDonated);
        case "donationCount":
          return d(statsSq.donationCount);
        case "lastDonationDate":
          return d(statsSq.lastDonationDate);
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
      recurringDonor: donors.recurringDonor,
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
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.database
        .select({ total: sql<number>`cast(count(*) as int)` })
        .from(donors)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.total ?? 0 };
  }

  /**
   * Find a donor by ID with all their donations (and org splits) and recurring donations.
   */
  async findByIdWithDonations(id: number) {
    return this.database.query.donors.findFirst({
      where: eq(donors.id, id),
      with: {
        donations: {
          orderBy: [desc(donations.datetime)],
          with: { organizationDonations: true },
        },
        recurringDonations: true,
      },
    });
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
