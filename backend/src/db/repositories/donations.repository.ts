import { eq, and, gte, lte, asc, desc, isNotNull, isNull, sql, inArray } from "drizzle-orm";
import { db, type Database } from "../client";
import { donations, type Donation, type NewDonation } from "../schema";

interface FindAllOptions {
  limit?: number;
  offset?: number;
}

interface FindByTransactionParams {
  amount: number;
  dateFrom: string | Date;
  dateTo: string | Date;
  idCode?: string;
}

interface SumParams {
  externalDonation?: boolean;
  excludeOrganizationInternalIds?: string[];
}

interface SumInRangeParams extends SumParams {
  dateFrom: string | Date;
  dateTo: string | Date;
}

export class DonationsRepository {
  constructor(private database: Database = db) {}

  /**
   * Find a donation by ID
   */
  async findById(id: number): Promise<Donation | undefined> {
    return this.database.query.donations.findFirst({
      where: eq(donations.id, id),
    });
  }

  /**
   * Find a donation by ID with all relations
   */
  async findByIdWithRelations(id: number) {
    return this.database.query.donations.findFirst({
      where: eq(donations.id, id),
      with: {
        donor: true,
        organizationDonations: true,
        recurringDonation: true,
        donationTransfer: true,
      },
    });
  }

  /**
   * Find donations by donor ID
   */
  async findByDonorId(donorId: number): Promise<Donation[]> {
    return this.database.query.donations.findMany({
      where: eq(donations.donorId, donorId),
      orderBy: [desc(donations.datetime)],
    });
  }

  /**
   * Find finalized donations
   */
  async findFinalized(): Promise<Donation[]> {
    return this.database.query.donations.findMany({
      where: eq(donations.finalized, true),
      orderBy: [desc(donations.datetime)],
    });
  }

  /**
   * Find unfinalized donations
   */
  async findUnfinalized(): Promise<Donation[]> {
    return this.database.query.donations.findMany({
      where: eq(donations.finalized, false),
      orderBy: [desc(donations.datetime)],
    });
  }

  /**
   * Find all donations (with pagination)
   */
  async findAll(options?: FindAllOptions) {
    return this.database.query.donations.findMany({
      orderBy: [desc(donations.datetime)],
      limit: options?.limit,
      offset: options?.offset,
      with: {
        donor: true,
        organizationDonations: true,
      },
    });
  }

  /**
   * Paginated, sortable, filterable donations list for the admin panel.
   */
  async findWithFilters(options: {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    finalized?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    donorId?: number;
    transferId?: number;
    hasTransfer?: boolean;
    hasCompany?: boolean;
    orgId?: string;
  }) {
    const { page, pageSize, sortBy = "datetime", sortDir = "desc" } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [];
    if (options.finalized !== undefined) conditions.push(eq(donations.finalized, options.finalized));
    if (options.dateFrom) conditions.push(gte(donations.datetime, options.dateFrom));
    if (options.dateTo) conditions.push(lte(donations.datetime, options.dateTo));
    if (options.donorId !== undefined) conditions.push(eq(donations.donorId, options.donorId));
    if (options.transferId !== undefined) conditions.push(eq(donations.donationTransferId, options.transferId));
    if (options.hasTransfer === true) conditions.push(isNotNull(donations.donationTransferId));
    if (options.hasTransfer === false) conditions.push(isNull(donations.donationTransferId));
    if (options.hasCompany === true) conditions.push(isNotNull(donations.companyCode));
    if (options.hasCompany === false) conditions.push(isNull(donations.companyCode));
    if (options.orgId) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM organization_donations
          WHERE organization_donations.donation_id = ${donations.id}
          AND organization_donations.organization_internal_id = ${options.orgId}
        )`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortCol = (() => {
      switch (sortBy) {
        case "id": return donations.id;
        case "amount": return donations.amount;
        case "finalized": return donations.finalized;
        case "paymentMethod": return donations.paymentMethod;
        case "companyName": return donations.companyName;
        default: return donations.datetime;
      }
    })();
    const orderByClause = sortDir === "asc" ? asc(sortCol) : desc(sortCol);

    const [data, countResult] = await Promise.all([
      this.database.query.donations.findMany({
        where,
        orderBy: [orderByClause],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        with: { donor: true, organizationDonations: true },
      }),
      this.database
        .select({ total: sql<number>`cast(count(*) as int)` })
        .from(donations)
        .where(where),
    ]);

    return { data, total: countResult[0]?.total ?? 0 };
  }

  /**
   * Find donation by transaction details (for matching bank transactions)
   */
  async findByTransaction(params: FindByTransactionParams) {
    const dateFrom =
      typeof params.dateFrom === "string"
        ? new Date(params.dateFrom)
        : params.dateFrom;
    const dateTo =
      typeof params.dateTo === "string"
        ? new Date(params.dateTo)
        : params.dateTo;

    // Find donations matching amount and date range
    const matchingDonations = await this.database.query.donations.findMany({
      where: and(
        eq(donations.amount, params.amount),
        gte(donations.datetime, dateFrom),
        lte(donations.datetime, dateTo)
      ),
      with: {
        donor: true,
      },
    });

    // If idCode provided, filter by donor's idCode
    if (params.idCode) {
      return matchingDonations.filter((d) => d.donor?.idCode === params.idCode);
    }

    return matchingDonations;
  }

  /**
   * Create a new donation
   */
  async create(data: NewDonation & { datetime?: string | Date }): Promise<Donation> {
    const [donation] = await this.database
      .insert(donations)
      .values({
        donorId: data.donorId ?? null,
        amount: data.amount,
        datetime:
          typeof data.datetime === "string"
            ? new Date(data.datetime)
            : data.datetime ?? new Date(),
        finalized: data.finalized !== undefined ? data.finalized : false,
        paymentMethod: data.paymentMethod || null,
        iban: data.iban || null,
        comment: data.comment || null,
        companyName: data.companyName || null,
        companyCode: data.companyCode || null,
        sentToOrganization:
          data.sentToOrganization !== undefined
            ? data.sentToOrganization
            : false,
        dedicationName: data.dedicationName || null,
        dedicationEmail: data.dedicationEmail || null,
        dedicationMessage: data.dedicationMessage || null,
        externalDonation:
          data.externalDonation !== undefined ? data.externalDonation : false,
        recurringDonationId: data.recurringDonationId || null,
        donationTransferId: data.donationTransferId || null,
      })
      .returning();
    if (!donation) throw new Error("Failed to insert donation");
    return donation;
  }

  /**
   * Update a donation
   */
  async update(id: number, data: Partial<NewDonation>): Promise<Donation | undefined> {
    const [donation] = await this.database
      .update(donations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(donations.id, id))
      .returning();
    return donation;
  }

  /**
   * Finalize a donation (mark as completed)
   */
  async finalize(id: number): Promise<Donation | undefined> {
    return this.update(id, { finalized: true });
  }

  /**
   * Mark donations as sent to organization
   */
  async markAsSentToOrganization(ids: number[]): Promise<Donation[]> {
    if (ids.length === 0) return [];

    return this.database
      .update(donations)
      .set({
        sentToOrganization: true,
        updatedAt: new Date(),
      })
      .where(inArray(donations.id, ids))
      .returning();
  }

  /**
   * Add donations to a transfer batch
   */
  async addToTransfer(donationIds: number[], transferId: number): Promise<Donation[]> {
    if (donationIds.length === 0) return [];

    return this.database
      .update(donations)
      .set({
        donationTransferId: transferId,
        updatedAt: new Date(),
      })
      .where(inArray(donations.id, donationIds))
      .returning();
  }

  /**
   * Sum of all finalized donations (excluding external donations and tips)
   * This is used for statistics
   */
  async sumFinalizedDonations(params?: SumParams): Promise<number> {
    // Build the WHERE conditions
    const conditions = [eq(donations.finalized, true)];

    if (params?.externalDonation !== undefined) {
      conditions.push(eq(donations.externalDonation, params.externalDonation));
    }

    // Get all matching donations
    const matchingDonations = await this.database.query.donations.findMany({
      where: and(...conditions),
      with: {
        organizationDonations: true,
      },
    });

    // If we need to exclude specific organizations, sum only the amounts
    // that don't go to those organizations
    const excludeIds = params?.excludeOrganizationInternalIds;
    if (excludeIds && excludeIds.length > 0) {
      let total = 0;
      for (const donation of matchingDonations) {
        const orgDonationsFiltered = donation.organizationDonations.filter(
          (od) => !excludeIds.includes(od.organizationInternalId)
        );
        total += orgDonationsFiltered.reduce((sum, od) => sum + od.amount, 0);
      }
      return total;
    }

    // Otherwise, sum all donation amounts
    return matchingDonations.reduce((sum, d) => sum + d.amount, 0);
  }

  /**
   * Sum of finalized donations within a date range (for campaigns)
   */
  async sumFinalizedDonationsInRange(params: SumInRangeParams): Promise<number> {
    const dateFrom =
      typeof params.dateFrom === "string"
        ? new Date(params.dateFrom)
        : params.dateFrom;
    const dateTo =
      typeof params.dateTo === "string"
        ? new Date(params.dateTo)
        : params.dateTo;

    const conditions = [
      eq(donations.finalized, true),
      gte(donations.datetime, dateFrom),
      lte(donations.datetime, dateTo),
    ];

    if (params.externalDonation !== undefined) {
      conditions.push(eq(donations.externalDonation, params.externalDonation));
    }

    const matchingDonations = await this.database.query.donations.findMany({
      where: and(...conditions),
      with: {
        organizationDonations: true,
      },
    });

    const excludeIdsInRange = params.excludeOrganizationInternalIds;
    if (excludeIdsInRange && excludeIdsInRange.length > 0) {
      let total = 0;
      for (const donation of matchingDonations) {
        const orgDonationsFiltered = donation.organizationDonations.filter(
          (od) => !excludeIdsInRange.includes(od.organizationInternalId)
        );
        total += orgDonationsFiltered.reduce((sum, od) => sum + od.amount, 0);
      }
      return total;
    }

    return matchingDonations.reduce((sum, d) => sum + d.amount, 0);
  }

  /**
   * Count total donations
   */
  async count(): Promise<number> {
    const result = await this.database.select({ count: sql`count(*)` }).from(donations);
    return Number(result[0].count);
  }

  /**
   * Count finalized donations
   */
  async countFinalized(): Promise<number> {
    const result = await this.database
      .select({ count: sql`count(*)` })
      .from(donations)
      .where(eq(donations.finalized, true));
    return Number(result[0].count);
  }

  /**
   * Delete a donation (and its organization_donations via cascade)
   */
  async delete(id: number): Promise<void> {
    await this.database.delete(donations).where(eq(donations.id, id));
  }

  /**
   * Find donations by date range
   */
  async findByDateRange(dateFrom: string | Date, dateTo: string | Date) {
    const from = typeof dateFrom === "string" ? new Date(dateFrom) : dateFrom;
    const to = typeof dateTo === "string" ? new Date(dateTo) : dateTo;

    return this.database.query.donations.findMany({
      where: and(gte(donations.datetime, from), lte(donations.datetime, to)),
      orderBy: [desc(donations.datetime)],
      with: {
        donor: true,
        organizationDonations: true,
      },
    });
  }

  /**
   * Find donations not yet sent to organizations
   */
  async findNotSentToOrganization() {
    return this.database.query.donations.findMany({
      where: and(
        eq(donations.finalized, true),
        eq(donations.sentToOrganization, false)
      ),
      orderBy: [desc(donations.datetime)],
      with: {
        donor: true,
        organizationDonations: true,
      },
    });
  }
}

export const donationsRepository = new DonationsRepository();
