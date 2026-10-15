import { useEffect, useState } from "react";
import { getHealth } from "@runcodes/api-client";

/** Offset (ms) between server wall-clock and the local clock. Fetched
 * once per mount tree and re-synced every 5 minutes; `null` until the
 * first sync lands (callers show a skeleton meanwhile). */
let cachedOffset: number | null = null;

const RESYNC_INTERVAL_MS = 5 * 60 * 1000;
const TICK_INTERVAL_MS = 1000;

async function syncOffset(): Promise<number | null> {
  try {
    const before = Date.now();
    const { now } = await getHealth();
    const after = Date.now();
    // Midpoint of the round-trip approximates the moment the server
    // stamped `now` — good enough for a seconds-precision clock.
    return new Date(now).getTime() - (before + after) / 2;
  } catch {
    return null;
  }
}

/** Live server time, ticking every second — the modern take on the
 * legacy run.codes "Server's Clock" that students relied on to track
 * deadlines. Returns `null` until the first sync completes. */
export function useServerClock(): Date | null {
  const [now, setNow] = useState<Date | null>(
    cachedOffset !== null ? new Date(Date.now() + cachedOffset) : null,
  );

  useEffect(() => {
    let disposed = false;

    async function sync() {
      const offset = await syncOffset();
      if (offset !== null) cachedOffset = offset;
    }

    if (cachedOffset === null) void sync();
    const resync = setInterval(() => void sync(), RESYNC_INTERVAL_MS);
    const tick = setInterval(() => {
      if (!disposed && cachedOffset !== null) {
        setNow(new Date(Date.now() + cachedOffset));
      }
    }, TICK_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(resync);
      clearInterval(tick);
    };
  }, []);

  return now;
}
