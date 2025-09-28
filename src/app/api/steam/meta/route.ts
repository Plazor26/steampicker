import type { NextRequest } from "next/server";

/**
 * Helper: create a Date that represents y-m-d h:m in a given IANA timezone,
 * then convert it to a real UTC Date (DST-safe, no libs).
 */
function zonedToUTC(
  y: number,
  m0: number, // 0-based month
  d: number,
  h = 10,
  min = 0,
  tz = "America/Los_Angeles"
): Date {
  // Start with a UTC "guess" at that wall time
  const utcGuess = new Date(Date.UTC(y, m0, d, h, min));
  // What wall time does that instant correspond to in tz?
  const tzDate = new Date(
    utcGuess.toLocaleString("en-US", { timeZone: tz })
  );
  // Offset = UTC - TZ-instant; adjust to hit the *actual* wall time in tz
  const offsetMs = utcGuess.getTime() - tzDate.getTime();
  return new Date(utcGuess.getTime() + offsetMs);
}

/**
 * 2025 seasonal sale windows (official press/Valve timing @ 10 AM Pacific).
 * Starts/ends are constructed *at the storefront rollover time* (10:00 PT).
 * Sources: Valve/Steam news & press coverage. Sales start/end at 10 AM PT. 
 * (Examples: “offers end at 10 AM Pacific”; SteamDB shows UTC equivalents.) 
 */
const SALE_WINDOWS_2025 = [
  { label: "Spring Sale", start: zonedToUTC(2025, 2, 13), end: zonedToUTC(2025, 2, 20) }, // Mar 13–20, 10:00 PT
  { label: "Summer Sale", start: zonedToUTC(2025, 5, 26), end: zonedToUTC(2025, 6, 10) }, // Jun 26–Jul 10, 10:00 PT
  { label: "Autumn Sale", start: zonedToUTC(2025, 8, 29), end: zonedToUTC(2025, 9, 6)  }, // Sep 29–Oct 6, 10:00 PT
  { label: "Winter Sale", start: zonedToUTC(2025,11,18), end: zonedToUTC(2026, 0, 5)  }, // Dec 18–Jan 5, 10:00 PT
];

function activeOrNextSale(nowUTC: Date) {
  // Active → countdown to END
  for (const w of SALE_WINDOWS_2025) {
    if (nowUTC >= w.start && nowUTC <= w.end) {
      return { phase: "active" as const, label: w.label, target: w.end };
    }
  }
  // Upcoming → countdown to START
  const upcoming = SALE_WINDOWS_2025.find(w => nowUTC < w.start);
  if (upcoming) return { phase: "upcoming" as const, label: upcoming.label, target: upcoming.start };
  // If past Winter 2025, point to a reasonable 2026 Spring placeholder (10:00 PT)
  const spring2026 = zonedToUTC(2026, 2, 19); // adjust if Valve updates official date
  return { phase: "upcoming" as const, label: "Spring Sale", target: spring2026 };
}

/** Primary: total specials via Store Search JSON (returns total_count). */
async function fetchSpecialsTotal(country = "US", lang = "en"): Promise<number | null> {
  const url = `https://store.steampowered.com/search/results/?query=&specials=1&start=0&count=1&cc=${country}&l=${lang}&json=1&infinite=1`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://store.steampowered.com/search/?specials=1",
  };
  const r = await fetch(url, { headers, cache: "no-store", next: { revalidate: 0 } });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null) as any;
  return typeof j?.total_count === "number" ? j.total_count : null;
}

/** Fallback: “featuredcategories” specials list length (limited, but safe). */
async function fetchSpecialsFallback(country = "US", lang = "en"): Promise<number | null> {
  const r = await fetch(
    `https://store.steampowered.com/api/featuredcategories?cc=${country}&l=${lang}`,
    { headers: { Accept: "application/json" }, cache: "no-store", next: { revalidate: 0 } }
  );
  if (!r.ok) return null;
  const j = await r.json().catch(() => null) as any;
  const items = j?.specials?.items || j?.specials?.large_capsules || [];
  return Array.isArray(items) ? items.length : null;
}

export async function GET(_req: NextRequest) {
  const now = new Date(); // UTC now

  let gamesOnSale: number | null = null;
  try { gamesOnSale = await fetchSpecialsTotal("US", "en"); } catch {}
  if (gamesOnSale == null) {
    try { gamesOnSale = await fetchSpecialsFallback("US", "en"); } catch {}
  }

  const info = activeOrNextSale(now);

  return new Response(
    JSON.stringify({
      gamesOnSale,
      saleLabel: info.label,
      phase: info.phase,                    // "active" | "upcoming"
      saleTargetAt: info.target.toISOString(), // END if active, START if upcoming (UTC ISO)
      now: now.toISOString(),
    }),
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    }
  );
}
