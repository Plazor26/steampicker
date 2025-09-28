import { NextResponse, type NextRequest } from "next/server";

type AppPrice = {
  success: boolean;
  data?: {
    price_overview?: {
      currency: string; // e.g., "USD"
      initial: number;  // cents
      final: number;    // cents (discounted)
    };
    is_free?: boolean;
  };
};

const OWNED_URL = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";
const APPDETAILS_URL = "https://store.steampowered.com/api/appdetails";

/**
 * GET /api/steam/value/:steamId?cc=US
 * Requires STEAM_API_KEY.
 * Returns { ok, value, currency, cc, counted, missed }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ steamId: string }> }
) {
  const { steamId } = await params;
  const key = process.env.STEAM_API_KEY;

  if (!key) {
    return NextResponse.json({ error: "Missing STEAM_API_KEY" }, { status: 500 });
  }
  if (!steamId || !/^\d{17}$/.test(steamId.trim())) {
    return NextResponse.json(
      { error: "Invalid steamId (expected 17-digit SteamID64)" },
      { status: 400 }
    );
  }

  // Region / currency: query > header country > default US
  const url = new URL(req.url);
  const ccParam = url.searchParams.get("cc");
  const headerCC = req.headers.get("x-vercel-ip-country");
  const cc = (ccParam || headerCC || "US").toUpperCase();

  try {
    // 1) Get owned games (just appids)
    const ownedRes = await fetch(
      `${OWNED_URL}?key=${key}&steamid=${steamId}&include_appinfo=0&include_played_free_games=1`,
      { cache: "no-store" }
    );
    if (!ownedRes.ok) {
      return NextResponse.json(
        { error: `Owned games fetch failed (${ownedRes.status})` },
        { status: 502 }
      );
    }
    const ownedJson = await ownedRes.json();
    const ownedGames: { appid: number }[] = ownedJson?.response?.games ?? [];
    const appids = ownedGames.map((g) => g.appid);
    if (!appids.length) {
      return NextResponse.json({
        ok: true,
        value: 0,
        currency: "USD",
        cc,
        counted: 0,
        missed: 0,
      });
    }

    // 2) Query appdetails for each appid (price_overview) in small batches
    const CHUNK = 24;
    const CONCURRENCY = 6;

    let totalCents = 0;
    let currency = "USD";
    let counted = 0;
    let missed = 0;

    // Chunk appids
    const chunks: number[][] = [];
    for (let i = 0; i < appids.length; i += CHUNK) {
      chunks.push(appids.slice(i, i + CHUNK));
    }

    for (const group of chunks) {
      // Concurrency pool
      const results = await poolMap(
        group,
        CONCURRENCY,
        async (appid: number) => {
          const r = await fetch(`${APPDETAILS_URL}?appids=${appid}&filters=price_overview&cc=${cc}`, {
            cache: "no-store",
            headers: { accept: "application/json" },
          });
          if (!r.ok) return { ok: false };
          const j = (await r.json()) as Record<string, AppPrice>;
          const entry = j?.[String(appid)];
          if (!entry || !entry.success || !entry.data) return { ok: false };

          const pov = entry.data.price_overview;
          if (!pov) return { ok: false }; // free / no price / delisted
          // capture currency from first priced app
          currency = pov.currency || currency;
          return { ok: true, final: pov.final };
        }
      );

      for (const res of results) {
        if (res.ok && typeof res.final === "number") {
          totalCents += res.final;
          counted++;
        } else {
          missed++;
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        value: Math.round(totalCents / 100), // integer units in currency
        currency,
        cc,
        counted,
        missed,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Steam store API error", detail: String(err) },
      { status: 502 }
    );
  }
}

/* ---------- tiny concurrency helper without deps ---------- */
async function poolMap<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const ret: R[] = new Array(items.length) as any;
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const cur = i++;
      ret[cur] = await worker(items[cur]);
    }
  };
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, run);
  await Promise.all(runners);
  return ret;
}
