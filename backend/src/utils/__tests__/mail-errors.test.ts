import { describe, expect, it } from "vitest";
import { sendFailure } from "../../emails";

/** An error as nodemailer gives it. */
const failure = (fields: Record<string, unknown>) =>
  Object.assign(new Error("Failed"), fields);

describe("sendFailure", () => {
  it("is the address refused, when the server refused it for good", () => {
    expect(
      sendFailure(
        failure({
          code: "EENVELOPE",
          command: "RCPT TO",
          responseCode: 550,
          permanent: true,
        }),
      ),
    ).toBe("refused");
  });

  it("is the address deferred, when the server refused it for now", () => {
    for (const responseCode of [450, 452]) {
      expect(
        sendFailure(
          failure({ code: "EENVELOPE", command: "RCPT TO", responseCode }),
        ),
      ).toBe("deferred");
    }
  });

  it("is not taken, for anything else the server said no to, or was never asked", () => {
    for (const fields of [
      // Closing the connection, even at an address
      { code: "EENVELOPE", command: "RCPT TO", responseCode: 421 },
      { code: "ECONNECTION", command: "CONN", responseCode: 421 },
      // The sign-in, or the email itself
      {
        code: "EAUTH",
        command: "AUTH PLAIN",
        responseCode: 535,
        permanent: true,
      },
      { code: "EMESSAGE", command: "DATA", responseCode: 554, permanent: true },
      { code: "EENVELOPE", command: "API" },
      { code: "ESOCKET", command: "CONN", originalCode: "ECONNREFUSED" },
      { code: "ETIMEDOUT", command: "CONN", timeoutType: "CONNECT_TIMEOUT" },
      { code: "ETIMEDOUT", command: "CONN", timeoutType: "GREETING_TIMEOUT" },
      { code: "EDNS", command: "CONN" },
    ]) {
      expect(sendFailure(failure(fields))).toBe("notTaken");
    }
  });

  it("may be taken, when the connection went while waiting for the server", () => {
    for (const fields of [
      { code: "ETIMEDOUT", command: "CONN", timeoutType: "SOCKET_TIMEOUT" },
      { code: "ECONNECTION", command: "CONN" },
      { code: "ESOCKET", command: "CONN", originalCode: "ECONNRESET" },
      {},
    ]) {
      expect(sendFailure(failure(fields))).toBe("maybeTaken");
    }
    expect(sendFailure("Failed")).toBe("maybeTaken");
  });
});
