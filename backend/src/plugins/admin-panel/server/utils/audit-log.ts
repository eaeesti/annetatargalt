import type { Context } from "koa";
import { adminAuditLogRepository } from "../../../../db/repositories/adminAuditLog.repository";
import { currentUser } from "./current-user";

export async function auditLog(
  ctx: Context,
  action: string,
  recordId?: string,
  options: {
    /**
     * Not again when the same person did the same to the same record this
     * many minutes ago or less: for what's done over and over while working
     * on something, such as an editor saving as it goes.
     */
    onceWithinMinutes?: number;
  } = {},
): Promise<void> {
  try {
    const user = currentUser(ctx);
    if (!user) return;
    if (
      options.onceWithinMinutes &&
      (await adminAuditLogRepository.loggedWithin(
        {
          userId: String(user.id),
          action,
          recordId: recordId ?? null,
        },
        options.onceWithinMinutes,
      ))
    ) {
      return;
    }
    const ip = ctx.ip || null;
    await adminAuditLogRepository.log({
      userId: String(user.id),
      userEmail: user.email,
      action,
      recordId: recordId ?? null,
      ip,
    });
  } catch {
    // Never fail the request due to audit logging errors
  }
}
