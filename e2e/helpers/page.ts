import { expect } from "@playwright/test";
import type { Locator } from "@playwright/test";

/**
 * Clicks until what the click opens shows. A page from the server can be
 * clicked before React has made it work, the first time a cold server
 * serves it, and that click does nothing.
 */
export async function clickToOpen(control: Locator, opened: Locator) {
  await expect(async () => {
    if (!(await opened.isVisible())) await control.click();
    await expect(opened).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

/** Clicks a radio button until it's chosen, for the same reason. */
export async function choose(radio: Locator) {
  await expect(async () => {
    if (!(await radio.isChecked())) await radio.click();
    await expect(radio).toBeChecked({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}
