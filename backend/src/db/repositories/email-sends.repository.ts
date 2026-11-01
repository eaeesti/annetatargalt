import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, type Database } from "../client";
import { emailCampaigns, emailSends, type EmailSend } from "../schema";

/** How many times a copy is put back in the queue before it's failed. */
const MAX_ATTEMPTS = 3;

/** Now, as the times the app writes: in UTC, whatever the database's zone. */
const UTC_NOW = sql`(now() at time zone 'utc')`;

/** Whether `senderId` is the process sending an email now. */
function isSender(campaignId: number, senderId: string) {
  return sql`EXISTS (SELECT 1 FROM ${emailCampaigns} c
    WHERE c.id = ${campaignId} AND c.sender_id = ${senderId})`;
}

export class EmailSendsRepository {
  constructor(private database: Database = db) {}

  /**
   * Take the next queued copy of an email, to send it, as the email's sender
   * `senderId`: one not tried yet before one put back, and none waiting to
   * be tried again (`retryAt`). Two processes never take the same copy, and
   * one that isn't the sender any more takes none. Undefined when none is
   * left.
   */
  async claimNext(
    campaignId: number,
    senderId: string,
  ): Promise<EmailSend | undefined> {
    const result = await this.database.execute<{ id: number }>(sql`
      UPDATE email_sends SET status = 'claimed'
      WHERE id = (
        SELECT s.id FROM email_sends s
        WHERE s.campaign_id = ${campaignId} AND s.status = 'queued'
          AND EXISTS (SELECT 1 FROM email_campaigns c
            WHERE c.id = ${campaignId} AND c.sender_id = ${senderId})
          AND (s.retry_at IS NULL OR s.retry_at <= ${UTC_NOW})
        ORDER BY s.attempts, s.id LIMIT 1
        FOR UPDATE OF s SKIP LOCKED
      )
      RETURNING id
    `);
    const id = result.rows[0]?.id;
    if (!id) return undefined;
    return this.database.query.emailSends.findFirst({
      where: eq(emailSends.id, id),
    });
  }

  /**
   * Say that a claimed copy is about to go out, as the email's sender
   * `senderId`. From here on, a copy whose sending is cut off may have gone
   * out, so it isn't sent again. False, and nothing changes, when this
   * process isn't the sender any more: one that stalled until another took
   * over, which has put the copy back in the queue to send it itself.
   */
  async markSending(
    id: number,
    campaignId: number,
    senderId: string,
  ): Promise<boolean> {
    const [marked] = await this.database
      .update(emailSends)
      .set({ status: "sending" })
      .where(
        and(
          eq(emailSends.id, id),
          eq(emailSends.status, "claimed"),
          isSender(campaignId, senderId),
        ),
      )
      .returning({ id: emailSends.id });
    return Boolean(marked);
  }

  async markSent(id: number): Promise<void> {
    await this.database
      .update(emailSends)
      .set({ status: "sent", sentAt: new Date(), error: null })
      .where(eq(emailSends.id, id));
  }

  /**
   * A copy that didn't go out, and why, as the email's sender `senderId`.
   * Nothing changes when this process isn't the sender any more, as in
   * markSending: the copy may be the new sender's by now.
   */
  async markFailed(
    id: number,
    campaignId: number,
    senderId: string,
    error: string,
  ): Promise<void> {
    await this.database
      .update(emailSends)
      .set({ status: "failed", error: error.slice(0, 1000) })
      .where(
        and(
          eq(emailSends.id, id),
          inArray(emailSends.status, ["claimed", "sending"]),
          isSender(campaignId, senderId),
        ),
      );
  }

  /**
   * A copy that surely didn't go out back in the queue, behind those not
   * tried yet, and why, as the email's sender `senderId`, as in markFailed.
   * The third time, it's failed instead, so that a copy that can't go, for
   * whatever reason, doesn't hold up the rest. Not `tried` when what failed
   * wasn't the copy, as the mail server: then it's as it was. With
   * `retryInMinutes`, it isn't tried again before then.
   */
  async putBack(
    id: number,
    campaignId: number,
    senderId: string,
    error: string,
    {
      tried = true,
      retryInMinutes,
    }: { tried?: boolean; retryInMinutes?: number } = {},
  ): Promise<void> {
    const attempts = tried
      ? sql`${emailSends.attempts} + 1`
      : sql`${emailSends.attempts}`;
    await this.database
      .update(emailSends)
      .set({
        status: sql`CASE WHEN ${attempts} >= ${MAX_ATTEMPTS}
          THEN 'failed' ELSE 'queued' END`,
        attempts,
        error: error.slice(0, 1000),
        retryAt: retryInMinutes
          ? sql`${UTC_NOW} + make_interval(mins => ${retryInMinutes})`
          : null,
      })
      .where(
        and(
          eq(emailSends.id, id),
          inArray(emailSends.status, ["claimed", "sending"]),
          isSender(campaignId, senderId),
        ),
      );
  }

  /**
   * A copy whose donor turned that kind of email off after it was queued,
   * as the email's sender `senderId`, as in markFailed.
   */
  async markSkipped(
    id: number,
    campaignId: number,
    senderId: string,
  ): Promise<void> {
    await this.database
      .update(emailSends)
      .set({ status: "skipped" })
      .where(
        and(
          eq(emailSends.id, id),
          eq(emailSends.status, "claimed"),
          isSender(campaignId, senderId),
        ),
      );
  }

  /**
   * Queue again the copies a sender claimed but stopped before sending, and
   * with `failed`, the failed ones, to try them once more: only when the
   * team asks, as a failed one may fail again. Only for the process that
   * has just become the email's sender, so no other one is still working on
   * them.
   */
  async requeueUnsent(
    campaignId: number,
    { failed }: { failed: boolean },
  ): Promise<void> {
    await this.database
      .update(emailSends)
      .set({ status: "queued", error: null })
      .where(
        and(
          eq(emailSends.campaignId, campaignId),
          eq(emailSends.status, "claimed"),
        ),
      );
    if (failed) {
      // Tried again from the start
      await this.database
        .update(emailSends)
        .set({ status: "queued", error: null, attempts: 0, retryAt: null })
        .where(
          and(
            eq(emailSends.campaignId, campaignId),
            eq(emailSends.status, "failed"),
          ),
        );
    }
  }

  /**
   * Why sending last stopped before it finished, from the copy it put back
   * in the queue, if it did.
   */
  async findStopReason(campaignId: number): Promise<string | null> {
    const [copy] = await this.database
      .select({ error: emailSends.error })
      .from(emailSends)
      .where(
        and(
          eq(emailSends.campaignId, campaignId),
          eq(emailSends.status, "queued"),
          isNotNull(emailSends.error),
          // An address refused for now is why that copy waits, not why
          // sending stopped
          isNull(emailSends.retryAt),
        ),
      )
      .limit(1);
    return copy?.error ?? null;
  }

  /**
   * How many of an email's copies wait to be tried again, their addresses
   * refused for now, and when the first of them is.
   */
  async findWaiting(
    campaignId: number,
  ): Promise<{ waiting: number; nextTry: Date | null }> {
    const [row] = await this.database
      .select({
        waiting: sql<number>`cast(count(*) as int)`,
        nextTry: sql<Date | null>`min(${emailSends.retryAt})`.mapWith(
          emailSends.retryAt,
        ),
      })
      .from(emailSends)
      .where(
        and(
          eq(emailSends.campaignId, campaignId),
          eq(emailSends.status, "queued"),
          sql`${emailSends.retryAt} > ${UTC_NOW}`,
        ),
      );
    return { waiting: row?.waiting ?? 0, nextTry: row?.nextTry ?? null };
  }

  /** How many of an email's copies are at each status. */
  async countByStatus(campaignId: number): Promise<{
    queued: number;
    sending: number;
    sent: number;
    failed: number;
    skipped: number;
  }> {
    const rows = await this.database
      .select({
        status: emailSends.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(emailSends)
      .where(eq(emailSends.campaignId, campaignId))
      .groupBy(emailSends.status);
    const count = (status: string) =>
      rows.find((row) => row.status === status)?.count ?? 0;
    return {
      // A claimed copy hasn't gone out yet, and is sent if it's cut off.
      queued: count("queued") + count("claimed"),
      sending: count("sending"),
      sent: count("sent"),
      failed: count("failed"),
      skipped: count("skipped"),
    };
  }

  /** The copies that failed, with why, for the admin panel. */
  async findFailed(campaignId: number) {
    return this.database.query.emailSends.findMany({
      where: and(
        eq(emailSends.campaignId, campaignId),
        eq(emailSends.status, "failed"),
      ),
      columns: { donorId: true, error: true },
    });
  }
}

export const emailSendsRepository = new EmailSendsRepository();
