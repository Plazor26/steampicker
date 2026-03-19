import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy for Steam's appdetails — needed because Steam doesn't send CORS headers.
 * GET /api/steam/prices?appids=123,456&cc=IN
 * Returns price + basic info for each appid.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appids = searchParams.get("appids") || "";
  const cc = searchParams.get("cc") || "US";
  const filter = searchParams.get("filter") || "price_overview";

  if (!appids) {
    return NextResponse.json({ ok: false, error: "No appids" }, { status: 400 });
  }

  try {
    const r = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appids}&filters=${filter}&cc=${encodeURIComponent(cc)}`,
      { cache: "no-store" }
    );

    if (!r.ok) {
      console.log(`[PRICES] Steam returned ${r.status} for appids: ${appids.substring(0, 100)}`);
      // Return empty data instead of error — some appids may not exist
      return NextResponse.json({ ok: true, data: {} }, { status: 200 });
    }

    const text = await r.text();
    if (text.startsWith("<")) {
      console.log("[PRICES] Steam returned HTML (blocked)");
      return NextResponse.json({ ok: false, error: "Steam blocked" }, { status: 502 });
    }

    const data = JSON.parse(text);
    console.log(`[PRICES] OK: ${Object.keys(data).length} results for ${appids.split(",").length} appids`);

    return NextResponse.json({ ok: true, data }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    console.error("[PRICES] Error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
