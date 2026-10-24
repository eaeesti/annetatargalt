import type { Context } from "koa";
import { isRecord } from "../../../../utils/narrow";

/** The signed-in admin, as users-permissions put them on the request. */
export function currentUser(
  ctx: Context,
): { id: number; email: string } | undefined {
  const user: unknown = ctx.state.user;
  if (
    !isRecord(user) ||
    typeof user.id !== "number" ||
    typeof user.email !== "string"
  ) {
    return undefined;
  }
  return { id: user.id, email: user.email };
}
