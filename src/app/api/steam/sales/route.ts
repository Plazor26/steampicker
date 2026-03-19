import type { NextRequest } from "next/server";

/**
 * /api/steam/sales
 *
 * Fetches Steam sale/event dates from two official Valve sources:
 *  1. Steamworks partner page (major sales + Next Fests)
 *  2. Valve news group AJAX API (themed fests from schedule announcements)
 *  3. Live sale detection via store.steampowered.com/api/featured/
 *
 * Falls back to hardcoded dates only if both fetches fail.
 */

export type SaleEventData = {
  name: string;
  type: "major" | "fest" | "themed";
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  estimated: boolean;
  source: "valve" | "fallback";
};

/* ─── Date parsing helpers ─── */

/** Parse "March 19" or "July 9" with a year context into YYYY-MM-DD */
const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

function parseDate(monthDay: string, year: number): string | null {
  // "March 19" -> "2026-03-19"
  const m = monthDay.trim().match(/^(\w+)\s+(\d{1,2})$/);
  if (!m) return null;
  const mm = MONTHS[m[1].toLowerCase()];
  if (!mm) return null;
  return `${year}-${mm}-${m[2].padStart(2, "0")}`;
}

function parseDateRange(text: string, defaultYear: number): { start: string; end: string } | null {
  // Patterns:
  //   "March 19 - 26, 2026"
  //   "June 25 - July 9, 2026"
  //   "December 17, 2026 - January 4, 2027"
  //   "March 19 - 26"
  //   "Jun 15 - 22"

  // Full month names and abbreviations
  const monthPat = "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";

  // Pattern: "Month D, YYYY - Month D, YYYY" (cross-year)
  let m = text.match(new RegExp(`(${monthPat})\\s+(\\d{1,2}),?\\s*(\\d{4})\\s*[-\u2013]\\s*(${monthPat})\\s+(\\d{1,2}),?\\s*(\\d{4})`, "i"));
  if (m) {
    const start = parseDate(`${m[1]} ${m[2]}`, parseInt(m[3]));
    const end = parseDate(`${m[4]} ${m[5]}`, parseInt(m[6]));
    if (start && end) return { start, end };
  }

  // Pattern: "Month D - Month D, YYYY" (cross-month)
  m = text.match(new RegExp(`(${monthPat})\\s+(\\d{1,2})\\s*[-\u2013]\\s*(${monthPat})\\s+(\\d{1,2}),?\\s*(\\d{4})?`, "i"));
  if (m) {
    const year = m[5] ? parseInt(m[5]) : defaultYear;
    const start = parseDate(`${m[1]} ${m[2]}`, year);
    const end = parseDate(`${m[3]} ${m[4]}`, year);
    if (start && end) return { start, end };
  }

  // Pattern: "Month D - D, YYYY" (same month)
  m = text.match(new RegExp(`(${monthPat})\\s+(\\d{1,2})\\s*[-\u2013]\\s*(\\d{1,2}),?\\s*(\\d{4})?`, "i"));
  if (m) {
    const year = m[4] ? parseInt(m[4]) : defaultYear;
    const start = parseDate(`${m[1]} ${m[2]}`, year);
    const end = parseDate(`${m[1]} ${m[3]}`, year);
    if (start && end) return { start, end };
  }

  return null;
}

function classifyEvent(name: string): "major" | "fest" | "themed" {
  const lower = name.toLowerCase();
  if (lower.includes("spring sale") || lower.includes("summer sale") ||
      lower.includes("autumn sale") || lower.includes("winter sale") ||
      lower.includes("halloween sale") || lower.includes("lunar new year")) {
    return "major";
  }
  if (lower.includes("next fest")) return "fest";
  return "themed";
}

/* ─── Source 1: Steamworks partner page ─── */
async function fetchFromPartnerPage(): Promise<SaleEventData[]> {
  const res = await fetch("https://partner.steamgames.com/doc/marketing/upcoming_events", {
    headers: {
      "User-Agent": "SteamPicker/1.0 (open-source game recommendation tool)",
      Accept: "text/html",
    },
    next: { revalidate: 86400 }, // cache 24h
  });
  if (!res.ok) return [];
  const html = await res.text();

  const events: SaleEventData[] = [];
  const currentYear = new Date().getFullYear();

  // Look for patterns like: <strong>Spring Sale</strong> | March 19 - 26, 2026
  // Or: Spring Sale: March 19 - 26, 2026
  // Or table rows with sale name and date range
  const patterns = [
    // <strong>Name</strong> | dates
    /<strong>([^<]+)<\/strong>\s*\|?\s*([A-Z][a-z]+\s+\d{1,2}[\s\S]*?\d{4})/gi,
    // Name: dates or Name - dates in plain text
    /(?:^|\n)\s*((?:Spring|Summer|Autumn|Winter|Halloween)\s+Sale|Steam\s+Next\s+Fest|Lunar\s+New\s+Year)[:\s\-|]+([A-Z][a-z]+\s+\d{1,2}[^<\n]*?\d{4})/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const name = match[1].trim();
      const dateStr = match[2].trim();
      const range = parseDateRange(dateStr, currentYear);
      if (range) {
        // Avoid duplicates
        if (!events.some(e => e.name === name && e.start === range.start)) {
          events.push({
            name,
            type: classifyEvent(name),
            start: range.start,
            end: range.end,
            estimated: false,
            source: "valve",
          });
        }
      }
    }
  }

  return events;
}

/* ─── Source 2: Valve news group AJAX API ─── */
async function fetchFromValveNews(): Promise<SaleEventData[]> {
  // Clan account 4145017 = Valve's Steamworks news group
  const url = "https://store.steampowered.com/events/ajaxgetadjacentpartnerevents/?clan_accountid=4145017&count_after=30&count_before=5";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "SteamPicker/1.0",
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];

  const data = await res.json().catch(() => null);
  if (!data?.success || !data?.events) return [];

  const events: SaleEventData[] = [];

  for (const event of data.events) {
    const body: string = event?.announcement_body?.body || "";
    const title: string = event?.announcement_body?.headline || "";

    // Only process schedule announcement posts
    const isSchedule = /schedule|upcoming.*events|sales.*events|events.*scheduled/i.test(title) ||
                       /schedule|upcoming.*events/i.test(body.slice(0, 300));
    if (!isSchedule) continue;

    // Determine the year context from the post title/body
    const yearMatch = title.match(/20\d{2}/) || body.slice(0, 500).match(/20\d{2}/);
    const contextYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

    // Pattern 1: [url=...]Name[/url]: Month D - Month D (themed fests)
    const urlPat = /\[url=[^\]]*\]([^[]+)\[\/url\]\s*:?\s*([A-Z][a-z]+\s+\d{1,2}\s*[-\u2013]\s*[A-Za-z\s]*\d{1,2})/gi;
    let m;
    while ((m = urlPat.exec(body)) !== null) {
      const name = m[1].replace(/\s*[-:]?\s*$/, "").trim();
      const dateStr = m[2].trim();
      const range = parseDateRangeNoYear(dateStr, contextYear);
      if (range && name.length > 2 && name.length < 60) {
        addEvent(events, name, range, "valve");
      }
    }

    // Pattern 2: [b]Steam Seasonal Sale YYYY: Month D - Month D (Seasonal Sale)[/b]
    const boldPat = /\[(?:b|i)\](?:\[(?:b|i)\])?\s*(Steam\s+)?([^[\]]+?(?:Sale|Fest))[:\s]+([A-Z][a-z]+\s+\d{1,2}\s*[-\u2013]\s*[A-Za-z\s]*\d{1,2})/gi;
    while ((m = boldPat.exec(body)) !== null) {
      let name = m[2].replace(/\s*\d{4}\s*$/, "").trim();
      // Remove trailing "(Seasonal Sale)" etc
      name = name.replace(/\s*\(.*?\)\s*$/, "").trim();
      const dateStr = m[3].trim();
      const range = parseDateRangeNoYear(dateStr, contextYear);
      if (range && name.length > 2 && name.length < 60) {
        addEvent(events, name, range, "valve");
      }
    }
  }

  return events;
}

/** Parse date ranges without year (year comes from context) */
function parseDateRangeNoYear(text: string, year: number): { start: string; end: string } | null {
  const monthPat = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";

  // "Month D - Month D" (cross-month)
  let m = text.match(new RegExp(`(${monthPat})\\s+(\\d{1,2})\\s*[-\u2013]\\s*(${monthPat})\\s+(\\d{1,2})`, "i"));
  if (m) {
    const start = parseDate(`${m[1]} ${m[2]}`, year);
    // Handle cross-year (e.g., December - January)
    const startMonth = MONTHS[m[1].toLowerCase()];
    const endMonth = MONTHS[m[3].toLowerCase()];
    const endYear = (startMonth && endMonth && endMonth < startMonth) ? year + 1 : year;
    const end = parseDate(`${m[3]} ${m[4]}`, endYear);
    if (start && end) return { start, end };
  }

  // "Month D - D" (same month)
  m = text.match(new RegExp(`(${monthPat})\\s+(\\d{1,2})\\s*[-\u2013]\\s*(\\d{1,2})`, "i"));
  if (m) {
    const start = parseDate(`${m[1]} ${m[2]}`, year);
    const end = parseDate(`${m[1]} ${m[3]}`, year);
    if (start && end) return { start, end };
  }

  return null;
}

function addEvent(events: SaleEventData[], name: string, range: { start: string; end: string }, source: "valve" | "fallback") {
  // Clean up name
  name = name
    .replace(/^Steam\s+/, "")
    .replace(/\s*-?\s*\w+\s+\d{4}\s+Edition$/i, "")
    .replace(/\s*:\s*\w+\s+\d{4}$/i, "")     // "Next Fest: June 2026" -> "Next Fest"
    .replace(/\s*\d{4}\s*$/, "")               // "2025 Steam Autumn Sale" year prefix handled below
    .replace(/^\d{4}\s+Steam\s+/i, "")         // "2025 Steam Autumn Sale" -> "Autumn Sale"
    .replace(/\s*\d+$/, "")                    // "Scream 4" trailing number
    .replace(/\s*V\s+Fest$/i, " Fest")         // "Scream V Fest" -> "Scream Fest"
    .trim();

  // Deduplicate by overlapping date range (not just exact match)
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();
  const isDupe = events.some(e => {
    if (e.name !== name) return false;
    const es = new Date(e.start).getTime();
    const ee = new Date(e.end).getTime();
    // Overlapping ranges = duplicate
    return startMs <= ee && endMs >= es;
  });

  if (!isDupe) {
    events.push({
      name,
      type: classifyEvent(name),
      start: range.start,
      end: range.end,
      estimated: false,
      source,
    });
  }
}

/* ─── Fallback: hardcoded dates from Valve's published 2026 schedule ─── */
function fallbackEvents(): SaleEventData[] {
  return [
    { name: "Spring Sale",    type: "major", start: "2026-03-19", end: "2026-03-26", estimated: false, source: "fallback" },
    { name: "Steam Next Fest", type: "fest",  start: "2026-06-15", end: "2026-06-22", estimated: false, source: "fallback" },
    { name: "Summer Sale",    type: "major", start: "2026-06-25", end: "2026-07-09", estimated: false, source: "fallback" },
    { name: "Autumn Sale",    type: "major", start: "2026-10-01", end: "2026-10-08", estimated: false, source: "fallback" },
    { name: "Steam Next Fest", type: "fest",  start: "2026-10-19", end: "2026-10-26", estimated: false, source: "fallback" },
    { name: "Winter Sale",    type: "major", start: "2026-12-17", end: "2027-01-04", estimated: false, source: "fallback" },
  ];
}

/* ─── Live sale detection ─── */
type LiveCheck = {
  isMajorSaleActive: boolean;
  activeSaleName: string | null;
};

async function checkLiveSale(): Promise<LiveCheck> {
  try {
    const res = await fetch("https://store.steampowered.com/api/featured/", {
      headers: { "User-Agent": "SteamPicker/1.0", Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return { isMajorSaleActive: false, activeSaleName: null };
    const data = (await res.json()) as { layout?: string; large_capsules?: { name?: string }[] };
    const isActive = data.layout === "defcon1";
    return {
      isMajorSaleActive: isActive,
      activeSaleName: isActive ? (data.large_capsules?.[0]?.name ?? null) : null,
    };
  } catch {
    return { isMajorSaleActive: false, activeSaleName: null };
  }
}

/* ─── Deduplicate events (prefer valve source over fallback, overlap-aware) ─── */
function deduplicateEvents(events: SaleEventData[]): SaleEventData[] {
  const result: SaleEventData[] = [];
  for (const ev of events) {
    const startMs = new Date(ev.start).getTime();
    const endMs = new Date(ev.end).getTime();
    const existingIdx = result.findIndex(e => {
      if (e.name !== ev.name) return false;
      const es = new Date(e.start).getTime();
      const ee = new Date(e.end).getTime();
      return startMs <= ee && endMs >= es;
    });
    if (existingIdx === -1) {
      result.push(ev);
    } else if (ev.source === "valve" && result[existingIdx].source === "fallback") {
      result[existingIdx] = ev;
    }
  }
  return result;
}

/* ─── Handler ─── */
export async function GET(_req: NextRequest) {
  // Fetch from all sources in parallel
  const [partnerEvents, newsEvents, liveCheck] = await Promise.all([
    fetchFromPartnerPage().catch(() => [] as SaleEventData[]),
    fetchFromValveNews().catch(() => [] as SaleEventData[]),
    checkLiveSale(),
  ]);

  let events = [...partnerEvents, ...newsEvents];

  // If we got nothing from Valve, use fallback
  const dataSource = events.length > 0 ? "valve" as const : "fallback" as const;
  if (events.length === 0) {
    events = fallbackEvents();
  }

  // Deduplicate and sort
  const sorted = deduplicateEvents(events).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return Response.json(
    {
      events: sorted,
      liveCheck,
      dataSource,
      eventCount: sorted.length,
      fetchedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
      },
    }
  );
}
