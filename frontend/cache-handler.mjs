/**
 * Where Next keeps the pages and fetched data it caches between renders: in
 * memory, up to a size, dropping whatever was used least recently.
 *
 * Next's own cache writes every rendered page to disk as well, and keeps it
 * there forever. Every address anyone asks for is a page of the catch-all
 * route, if only a "not found" one, so bots trying addresses like /.env
 * filled the disk with thousands of them within hours. In memory with a cap,
 * they push each other out instead. Resized images aren't kept here: they
 * have a disk cache of their own, which survives deploys.
 *
 * Next decides from `lastModified` and each entry's cache lifetime when it is
 * stale; this only stores. The site uses no cache tags, so there is nothing
 * to expire by tag.
 */

const MAX_BYTES = 64 * 1024 * 1024;

/** Roughly how much memory a cached value holds: its text and binary parts. */
function sizeOf(value) {
  if (!value) return 0;
  let size = 0;
  for (const part of [value.html, value.rscData, value.body, value.pageData]) {
    if (typeof part === "string") size += part.length;
    else if (part && typeof part.byteLength === "number")
      size += part.byteLength;
    else if (part) size += JSON.stringify(part).length;
  }
  if (value.segmentData instanceof Map) {
    for (const segment of value.segmentData.values())
      size += segment.byteLength;
  }
  if (value.data) size += JSON.stringify(value.data).length;
  return size + 1024;
}

/** key → { entry, size }, in order of use: a Map iterates oldest first. */
const entries = new Map();
let totalBytes = 0;

export default class MemoryCacheHandler {
  async get(key) {
    const stored = entries.get(key);
    if (!stored) return null;
    entries.delete(key);
    entries.set(key, stored);
    return stored.entry;
  }

  async set(key, data, ctx) {
    const previous = entries.get(key);
    if (previous) {
      totalBytes -= previous.size;
      entries.delete(key);
    }
    const size = sizeOf(data);
    if (size > MAX_BYTES / 4) return;
    entries.set(key, {
      entry: {
        value: data,
        lastModified: Date.now(),
        cacheControl: ctx?.cacheControl,
      },
      size,
    });
    totalBytes += size;
    for (const [oldKey, old] of entries) {
      if (totalBytes <= MAX_BYTES) break;
      entries.delete(oldKey);
      totalBytes -= old.size;
    }
  }

  async revalidateTag() {}

  resetRequestCache() {}
}
