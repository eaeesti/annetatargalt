import { and, desc, eq, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db, type Database } from "../client";
import {
  donors,
  emailCampaigns,
  emailSends,
  type EmailCampaign,
  type NewEmailCampaign,
} from "../schema";
import { recurringActivityCutoff } from "./recurring-activity";
import {
  type AudienceFilters,
  type EmailKind,
  type Gifts,
  type Period,
  type Recipient,
} from "../../utils/email-campaign";
import { addressOf, addressWants } from "../../utils/address";
import { SETTING_OF_KIND } from "../../utils/email-preferences";
import { estonianDay } from "../../utils/estonian-time";
import { toLocale } from "../../utils/locale";

/** A period's first instant and the instant after it, in Estonian time. */
function periodBounds(period: Period): { start: Date; end: Date } {
  const first = estonianDay(period.from);
  const last = estonianDay(period.to);
  if (!first || !last) throw new Error("A period's days aren't dates");
  return { start: first[0], end: last[1] };
}

/** The donor setting a kind of email asks, as a column of donors `d`. */
function settingColumn(kind: EmailKind): SQL {
  return sql`d.${sql.identifier(donors[SETTING_OF_KIND[kind]].name)}`;
}

export class EmailCampaignsRepository {
  constructor(private database: Database = db) {}

  /**
   * Every email, newest first, with how many donors it went out to. Its
   * times are read as the columns map them, as moments, so they show the
   * same wherever they're read.
   */
  async findAll() {
    const count = (status: string) =>
      sql<number>`cast(count(*) FILTER (WHERE ${emailSends.status} = ${status}) as int)`;
    return this.database
      .select({
        id: emailCampaigns.id,
        kind: emailCampaigns.kind,
        name: emailCampaigns.name,
        status: emailCampaigns.status,
        createdBy: emailCampaigns.createdBy,
        createdAt: emailCampaigns.createdAt,
        sentAt: emailCampaigns.sentAt,
        sent: count("sent"),
        failed: count("failed"),
      })
      .from(emailCampaigns)
      .leftJoin(emailSends, eq(emailSends.campaignId, emailCampaigns.id))
      .groupBy(emailCampaigns.id)
      .orderBy(desc(emailCampaigns.createdAt));
  }

  async findById(id: number): Promise<EmailCampaign | undefined> {
    return this.database.query.emailCampaigns.findFirst({
      where: eq(emailCampaigns.id, id),
    });
  }

  async create(data: NewEmailCampaign): Promise<EmailCampaign> {
    const [campaign] = await this.database
      .insert(emailCampaigns)
      .values(data)
      .returning();
    if (!campaign) throw new Error("Failed to insert email");
    return campaign;
  }

  /**
   * Change a draft, with `save`, the editor's id and the number of this
   * save among its own. Undefined when it isn't one any more: sending has
   * started since it was read, so a late autosave can't change what goes
   * out. Undefined too for a save that arrives after a later one from the
   * same editor (see emailCampaigns.editorId).
   */
  async updateDraft(
    id: number,
    data: Partial<
      Pick<NewEmailCampaign, "kind" | "name" | "content" | "audience">
    >,
    save?: { editor: string; number: number },
  ): Promise<EmailCampaign | undefined> {
    const [campaign] = await this.database
      .update(emailCampaigns)
      .set({
        ...data,
        editorId: save?.editor,
        editorSave: save?.number,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailCampaigns.id, id),
          eq(emailCampaigns.status, "draft"),
          save
            ? sql`(${emailCampaigns.editorId} IS DISTINCT FROM ${save.editor}
                OR ${emailCampaigns.editorSave} < ${save.number})`
            : undefined,
        ),
      )
      .returning();
    return campaign;
  }

  /**
   * Delete a draft. False when it isn't one any more: sending has started
   * since it was read.
   */
  async removeDraft(id: number): Promise<boolean> {
    const deleted = await this.database
      .delete(emailCampaigns)
      .where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.status, "draft")))
      .returning({ id: emailCampaigns.id });
    return deleted.length > 0;
  }

  /**
   * The donors an email of a kind goes to: one per email address, for those
   * who want that kind of email and have given at least once (a donation
   * never paid for leaves a donor behind too), narrowed by the filters.
   *
   * One person can have more than one donor row with the same address, in
   * different letter case too, and gets one copy. It's addressed as the row
   * that gave last, in the language of that gift; they're recurring or have
   * an ID code if any of their rows is or has one, and want the email only
   * if every row that gave says so.
   */
  async findRecipients(
    kind: EmailKind,
    filters: AudienceFilters,
  ): Promise<Recipient[]> {
    const period = filters.period && periodBounds(filters.period);
    const recipients = await this.recipients(
      kind,
      sql`
      ${filters.locale ? sql`AND coalesce(r.locale, 'et') = ${filters.locale}` : sql``}
      ${typeof filters.recurring === "boolean" ? sql`AND r.recurring = ${filters.recurring}` : sql``}
      ${filters.hasIdCode === true ? sql`AND coalesce(r.id_code, '') <> ''` : sql``}
      ${filters.hasIdCode === false ? sql`AND coalesce(r.id_code, '') = ''` : sql``}
      ${
        filters.emails
          ? filters.emails.length
            ? sql`AND r.address IN (${sql.join(
                filters.emails.map((email) => sql`${email}`),
                sql`, `,
              )})`
            : sql`AND false`
          : sql``
      }
      ${
        period
          ? sql`AND EXISTS (SELECT 1 FROM donations dn
              JOIN donors dd ON dd.id = dn.donor_id
              WHERE ${addressOf(sql.raw("dd.email"))} = r.address AND dn.finalized
                AND dn.datetime >= ${period.start.toISOString()} AND dn.datetime < ${period.end.toISOString()})`
          : sql``
      }
    `,
    );
    return filters.period
      ? this.withGifts(recipients, filters.period)
      : recipients;
  }

  /**
   * The recipient a queued copy goes to now: the person with donor
   * `donorId`'s address, if they still want that kind of email, with what
   * they gave in the email's period.
   */
  async findRecipient(
    kind: EmailKind,
    donorId: number,
    filters: AudienceFilters = {},
  ): Promise<Recipient | undefined> {
    const recipients = await this.recipients(
      kind,
      sql`AND r.address = (
        SELECT ${addressOf(sql.raw("d.email"))} FROM donors d WHERE d.id = ${donorId}
      )`,
    );
    const [recipient] = filters.period
      ? await this.withGifts(recipients, filters.period)
      : recipients;
    return recipient;
  }

  /**
   * Recipients with what each gave in a period, from all the donor rows of
   * their address: how many donations, how much to each organization, and
   * how much of it through a company.
   */
  private async withGifts(
    recipients: Recipient[],
    period: Period,
  ): Promise<Recipient[]> {
    if (recipients.length === 0) return recipients;
    const { start, end } = periodBounds(period);
    // Matched to each recipient's address in the database, which says
    // which rows are one address: the app's own reading could differ.
    const result = await this.database.execute<{
      recipient_id: number;
      donation_id: number;
      company: boolean;
      internal_id: string | null;
      amount: number | null;
    }>(sql`
      SELECT r.id AS recipient_id, dn.id AS donation_id,
        (coalesce(trim(dn.company_name), '') <> ''
          OR coalesce(trim(dn.company_code), '') <> '') AS company,
        od.organization_internal_id AS internal_id, od.amount
      FROM donors r
      JOIN donors d
        ON ${addressOf(sql.raw("d.email"))} = ${addressOf(sql.raw("r.email"))}
      JOIN donations dn ON dn.donor_id = d.id
      LEFT JOIN organization_donations od ON od.donation_id = dn.id
      WHERE dn.finalized
        AND dn.datetime >= ${start.toISOString()} AND dn.datetime < ${end.toISOString()}
        AND r.id IN (${sql.join(
          recipients.map((r) => sql`${r.donorId}`),
          sql`, `,
        )})
    `);

    const gifts = new Map<
      number,
      {
        donations: Set<number>;
        byOrganization: Map<string, number>;
        company: number;
      }
    >();
    for (const row of result.rows) {
      const entry = gifts.get(row.recipient_id) ?? {
        donations: new Set<number>(),
        byOrganization: new Map<string, number>(),
        company: 0,
      };
      entry.donations.add(row.donation_id);
      if (row.internal_id && row.amount) {
        entry.byOrganization.set(
          row.internal_id,
          (entry.byOrganization.get(row.internal_id) ?? 0) + row.amount,
        );
        if (row.company) entry.company += row.amount;
      }
      gifts.set(row.recipient_id, entry);
    }

    return recipients.map((recipient) => {
      const entry = gifts.get(recipient.donorId);
      const given: Gifts = {
        count: entry?.donations.size ?? 0,
        byOrganization: [...(entry?.byOrganization ?? [])].map(
          ([internalId, cents]) => ({ internalId, cents }),
        ),
        companyCents: entry?.company ?? 0,
      };
      return { ...recipient, gifts: given };
    });
  }

  private async recipients(kind: EmailKind, where: SQL): Promise<Recipient[]> {
    const recurringCutoff = recurringActivityCutoff();
    const result = await this.database.execute<{
      id: number;
      email: string;
      first_name: string | null;
      last_name: string | null;
      id_code: string | null;
      locale: string | null;
      recurring: boolean;
    }>(sql`
      SELECT * FROM (
        SELECT DISTINCT ON (g.address) g.id, g.address, g.email,
          g.first_name, g.last_name, g.any_id_code AS id_code, g.locale,
          g.any_recurring AS recurring, g.all_want AS wants, g.last_gift
        FROM (
          SELECT p.*,
            ${addressWants(sql.raw("p.wants"), sql.raw("p.last_gift IS NOT NULL"), "address")} AS all_want,
            bool_or(p.recurring) FILTER (WHERE p.last_gift IS NOT NULL)
              OVER address AS any_recurring,
            max(nullif(p.id_code, '')) FILTER (WHERE p.last_gift IS NOT NULL)
              OVER address AS any_id_code
          FROM (
            SELECT d.id, trim(d.email) AS email, d.first_name, d.last_name,
              d.id_code, ${addressOf(sql.raw("d.email"))} AS address,
              ${settingColumn(kind)} AS wants,
              -- A standing order's payments come in with bank statements:
              -- their language is the one the order was set up in.
              (SELECT coalesce(rd.locale, dn.locale) FROM donations dn
                LEFT JOIN recurring_donations rd
                  ON rd.id = dn.recurring_donation_id
                WHERE dn.donor_id = d.id AND dn.finalized
                ORDER BY dn.datetime DESC LIMIT 1) AS locale,
              (SELECT max(dn.datetime) FROM donations dn
                WHERE dn.donor_id = d.id AND dn.finalized) AS last_gift,
              EXISTS (SELECT 1 FROM donations dn
                WHERE dn.donor_id = d.id AND dn.finalized
                  AND dn.recurring_donation_id IS NOT NULL
                  AND dn.datetime >= ${recurringCutoff.toISOString()}) AS recurring
            FROM donors d
            WHERE d.email IS NOT NULL AND trim(d.email) <> ''
          ) p
          WINDOW address AS (PARTITION BY p.address)
        ) g
        ORDER BY g.address, g.last_gift DESC NULLS LAST, g.id DESC
      ) r
      -- Addresses that gave, written as their row that gave last writes it
      WHERE r.last_gift IS NOT NULL AND r.wants
        ${where}
      ORDER BY r.id
    `);
    return result.rows.map((row) => ({
      donorId: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      idCode: row.id_code,
      locale: toLocale(row.locale),
      recurring: row.recurring,
    }));
  }

  /**
   * Turn a draft into an email being sent, with a copy queued for each of
   * `donorIds`: the group is decided once, here, so continuing or retrying
   * never reaches anyone who joined it since. Only while it's still
   * `checked`, when that's given: its kind, content and group as they were
   * checked, so what was checked is what goes out. False when it wasn't that
   * draft any more: saved since, or started by someone else first.
   */
  async queue(
    id: number,
    donorIds: number[],
    checked?: Pick<EmailCampaign, "kind" | "content" | "audience">,
  ): Promise<boolean> {
    return this.database.transaction(async (tx) => {
      const [started] = await tx
        .update(emailCampaigns)
        .set({ status: "sending", updatedAt: new Date() })
        .where(
          and(
            eq(emailCampaigns.id, id),
            eq(emailCampaigns.status, "draft"),
            ...(checked
              ? [
                  eq(emailCampaigns.kind, checked.kind),
                  sql`${emailCampaigns.content} = ${JSON.stringify(checked.content)}::jsonb`,
                  sql`${emailCampaigns.audience} = ${JSON.stringify(checked.audience)}::jsonb`,
                ]
              : []),
          ),
        )
        .returning({ id: emailCampaigns.id });
      if (!started) return false;
      if (donorIds.length > 0) {
        await tx
          .insert(emailSends)
          .values(donorIds.map((donorId) => ({ campaignId: id, donorId })))
          .onConflictDoNothing();
      }
      return true;
    });
  }

  /**
   * Become the process that sends an email, as `senderId`, unless another
   * one is: one whose heartbeat is fresh. `resumed` when it goes on by
   * itself, which an email held for the team doesn't. True when this one is
   * to send it.
   */
  async claimSending(
    id: number,
    senderId: string,
    { resumed = false }: { resumed?: boolean } = {},
  ): Promise<boolean> {
    const [claimed] = await this.database
      .update(emailCampaigns)
      .set({
        status: "sending",
        heartbeatAt: new Date(),
        senderId,
        heldFor: null,
      })
      .where(
        and(
          eq(emailCampaigns.id, id),
          ne(emailCampaigns.status, "draft"),
          or(
            isNull(emailCampaigns.heartbeatAt),
            lt(emailCampaigns.heartbeatAt, staleBefore()),
          ),
          // Going on by itself, never with an email held for the team
          resumed ? isNull(emailCampaigns.heldFor) : undefined,
        ),
      )
      .returning({ id: emailCampaigns.id });
    return Boolean(claimed);
  }

  /**
   * Say that sending an email is still going on, as its sender. False when
   * another process has taken it over since: this one is to stop.
   */
  async beat(id: number, senderId: string): Promise<boolean> {
    const [still] = await this.database
      .update(emailCampaigns)
      .set({ heartbeatAt: new Date() })
      .where(
        and(eq(emailCampaigns.id, id), eq(emailCampaigns.senderId, senderId)),
      )
      .returning({ id: emailCampaigns.id });
    return Boolean(still);
  }

  /**
   * Stop sending an email, as its sender: sent, once no copy of it is left
   * to go out, either queued or claimed by a sender that stopped before
   * sending it. Otherwise, with `heldFor`, held until the team goes on with
   * it. Nothing when another process has taken it over. An email sent
   * before keeps the time it was first sent when its failed copies are
   * tried again.
   */
  async finishSending(
    id: number,
    senderId: string,
    heldFor: string | null = null,
  ): Promise<void> {
    await this.database.execute(sql`
      UPDATE email_campaigns c SET heartbeat_at = NULL, sender_id = NULL,
        status = CASE WHEN left_over.copies THEN c.status ELSE 'sent' END,
        sent_at = CASE WHEN left_over.copies THEN c.sent_at
          ELSE coalesce(c.sent_at, now() at time zone 'utc') END,
        held_for = CASE WHEN left_over.copies THEN ${heldFor} END
      FROM (SELECT EXISTS (SELECT 1 FROM email_sends
        WHERE campaign_id = ${id} AND status IN ('queued', 'claimed')) AS copies
      ) left_over
      WHERE c.id = ${id} AND c.sender_id = ${senderId}
    `);
  }

  /**
   * The emails whose sending was cut off, by a deploy or a crash: still
   * being sent, with no process sending them, and not held for the team.
   */
  async findCutOff(): Promise<EmailCampaign[]> {
    return this.database.query.emailCampaigns.findMany({
      where: and(
        eq(emailCampaigns.status, "sending"),
        or(
          isNull(emailCampaigns.heartbeatAt),
          lt(emailCampaigns.heartbeatAt, staleBefore()),
        ),
        isNull(emailCampaigns.heldFor),
      ),
    });
  }

  /** Whether a process is sending an email now. */
  static isSending(campaign: Pick<EmailCampaign, "heartbeatAt">): boolean {
    return Boolean(
      campaign.heartbeatAt && campaign.heartbeatAt >= staleBefore(),
    );
  }
}

/**
 * How long a sending process can go without a heartbeat before it's taken to
 * have stopped, far longer than one email takes: the mail server's timeouts
 * are well under it (config/plugins.js). Should a send hang for longer, a
 * second process may start too, which costs only the pace: each copy is
 * claimed by one process (EmailSendsRepository.claimNext).
 */
const HEARTBEAT_STALE_MS = 2 * 60 * 1000;

function staleBefore(): Date {
  return new Date(Date.now() - HEARTBEAT_STALE_MS);
}

export const emailCampaignsRepository = new EmailCampaignsRepository();
