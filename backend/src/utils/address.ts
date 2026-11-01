import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/*
 * One email address, however it's written: the emails go to addresses, and
 * one person can have donor rows whose address differs only in letter case
 * or spaces around it. They're one address, these say which, in the
 * database and in the app alike. The donors table has an index on it.
 */

/** The address an email column holds, in SQL. */
export function addressOf(email: SQLWrapper): SQL {
  return sql`lower(trim(${email}))`;
}

/**
 * The address an email is, in the app. Only spaces are trimmed, as SQL's
 * trim does: a tab or a no-break space left on an old address keeps it
 * apart in both.
 */
export function normalAddress(email: string): string {
  return email.replace(/^ +| +$/g, "").toLowerCase();
}

/**
 * Whether an address wants a kind of email, from its donor rows' `setting`:
 * whether every row that gave wants it, or, when none gave, every row. One
 * row with it off is enough. Sending and the settings page decide it with
 * this alike. An aggregate, or a window function `over` a window.
 */
export function addressWants(
  setting: SQLWrapper,
  gave: SQLWrapper,
  over?: string,
): SQL<boolean> {
  const window = over ? sql` OVER ${sql.identifier(over)}` : sql``;
  return sql<boolean>`coalesce(bool_and(${setting}) FILTER (WHERE ${gave})${window}, bool_and(${setting})${window})`;
}
