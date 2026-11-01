import type { NextRequest } from "next/server";
import { relay, strapiAdmin } from "../../../../lib/api";

/**
 * A picture for an email, sent on as it came: the `files` and `description`
 * form fields. The backend checks who sends it and what it is; nothing goes
 * there without a session.
 */
export async function POST(request: NextRequest) {
  return relay(
    await strapiAdmin("/api/admin-panel/emails/images", {
      method: "POST",
      body: await request.formData(),
      cache: "no-store",
    }),
  );
}
