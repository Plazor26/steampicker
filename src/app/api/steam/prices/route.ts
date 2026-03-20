import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy for Steam's appdetails — needed because Steam doesn't send CORS headers.
 *
 * GET /api/steam/prices?appids=123,456&cc=IN
 *   → batch price_overview for all appids
 *
 * GET /api/steam/prices?appids=123,456&cc=IN&detail=1
 *   → individual basic calls for each appid (name, header_image, type, price)
 *   → use only for a few missing games, NOT 30 at once
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appids = (searchParams.get("appids") || "").split(",").filter(Boolean);
  const cc = searchParams.get("cc") || "US";
  const detail = searchParams.get("detail") === "1";

  if (!appids.length) {
    return NextResponse.json({ ok: false, error: "No appids" }, { status: 400 });
  }

  try {
    if (detail) {
      // Individual calls with 'basic' filter for name/header/type + price
      // Only use for small sets (1-5 games)
      const data: Record<string, any> = {};
      for (const id of appids.slice(0, 10)) {
        try {
          const r = await fetch(
            `https://store.steampowered.com/api/appdetails?appids=${id}&cc=${encodeURIComponent(cc)}`,
            { cache: "no-store" }
          );
          if (!r.ok) continue;
          const text = await r.text();
          if (text.startsWith("<")) continue;
          const j = JSON.parse(text);
          data[id] = j[id];
        } catch { /* skip */ }
      }
      console.log(`[PRICES] Detail: ${Object.keys(data).length} results for ${appids.length} appids`);
      return NextResponse.json({ ok: true, data }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
      });
    }

    // Batch price_overview (works for up to 100 appids)
    const r = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appids.join(",")}&filters=price_overview&cc=${encodeURIComponent(cc)}`,
      { cache: "no-store" }
    );

    if (!r.ok) {
      console.log(`[PRICES] Steam returned ${r.status}`);
      return NextResponse.json({ ok: true, data: {} });
    }

    const text = await r.text();
    if (text.startsWith("<")) {
      console.log("[PRICES] Steam returned HTML (blocked)");
      return NextResponse.json({ ok: false, error: "Steam blocked" }, { status: 502 });
    }

    const data = JSON.parse(text);
    console.log(`[PRICES] OK: ${Object.keys(data).length} results for ${appids.length} appids`);

    return NextResponse.json({ ok: true, data }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    console.error("[PRICES] Error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
