import { describe, it, expect } from "vitest";
import {
  currentToken,
  keepToken,
  type TokenPlace,
} from "../email-settings-token";

/** A tab at the settings page, with what's in its address and its storage. */
function tab(hash: string, kept: string | null = null, storageWorks = true) {
  const items = new Map<string, string>(
    kept ? [["emailSettingsToken", kept]] : [],
  );
  const location = { hash, pathname: "/teavitused", search: "" };
  const addresses: string[] = [];
  const place: TokenPlace = {
    location,
    history: {
      replaceState: (
        _state: unknown,
        _unused: string,
        url?: string | URL | null,
      ) => {
        addresses.push(String(url));
        location.hash = "";
      },
    },
    storage: () => {
      if (!storageWorks) throw new Error("The operation is insecure.");
      return {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => {
          items.set(key, value);
        },
      };
    },
  };
  return { place, location, addresses };
}

describe("the email settings page's token", () => {
  it("is taken out of the address, and kept for the tab", () => {
    const { place, location, addresses } = tab("#token=7.abc");

    expect(currentToken(place)).toBe("7.abc");
    keepToken(place);

    expect(addresses).toEqual(["/teavitused"]);
    expect(location.hash).toBe("");
    expect(currentToken(place)).toBe("7.abc");
  });

  it("is found in the tab after a reload", () => {
    const { place } = tab("", "7.abc");
    expect(currentToken(place)).toBe("7.abc");
  });

  it("comes from a link followed since, over the one kept", () => {
    const { place } = tab("#token=8.def", "7.abc");
    expect(currentToken(place)).toBe("8.def");
    keepToken(place);
    expect(currentToken(place)).toBe("8.def");
  });

  it("stays in the address when the tab can't keep it", () => {
    const { place, location, addresses } = tab("#token=7.abc", null, false);

    keepToken(place);

    expect(addresses).toEqual([]);
    expect(location.hash).toBe("#token=7.abc");
    expect(currentToken(place)).toBe("7.abc");
  });

  it("is none without a link or one kept", () => {
    expect(currentToken(tab("").place)).toBeNull();
    expect(currentToken(tab("", null, false).place)).toBeNull();
  });
});
