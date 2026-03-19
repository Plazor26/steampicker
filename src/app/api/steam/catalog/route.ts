// src/app/api/steam/catalog/route.ts
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qCC = searchParams.get("cc")?.toUpperCase();
    const ipCC =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("x-forwarded-country") ||
      req.headers.get("cf-ipcountry") ||
      undefined;
    const cc = (qCC || ipCC || "US").toUpperCase();

    // Fetch featured categories and featured games in parallel
    const [catRes, featRes] = await Promise.allSettled([
      fetch(`https://store.steampowered.com/api/featuredcategories/?l=en&cc=${encodeURIComponent(cc)}`, {
        next: { revalidate: 300 },
      }),
      fetch(`https://store.steampowered.com/api/featured/?l=en&cc=${encodeURIComponent(cc)}`, {
        next: { revalidate: 300 },
      }),
    ]);

    const seen = new Set<number>();
    const out: any[] = [];

    function ingest(items: any[]) {
      for (const it of items) {
        const appid = typeof it?.id === "number" ? it.id : typeof it?.appid === "number" ? it.appid : undefined;
        if (!appid || seen.has(appid)) continue;
        seen.add(appid);
        out.push({
          appid,
          name: it?.name ?? "Unknown",
          header:
            it?.header_image ??
            it?.large_capsule_image ??
            `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
          discount_pct: it?.discount_percent ?? 0,
          price_cents: typeof it?.final_price === "number" ? it.final_price : null,
          original_price_cents: typeof it?.original_price === "number" ? it.original_price : null,
        });
      }
    }

    if (catRes.status === "fulfilled" && catRes.value.ok) {
      const j = await catRes.value.json();
      const buckets = [
        j?.top_sellers?.items ?? [],
        j?.specials?.items ?? [],
        j?.trending_new_releases?.items ?? [],
        j?.popular_new_releases?.items ?? [],
        j?.new_releases?.items ?? [],
        j?.coming_soon?.items ?? [],
      ];
      for (const arr of buckets) ingest(arr);
    }

    if (featRes.status === "fulfilled" && featRes.value.ok) {
      const j = await featRes.value.json();
      const buckets = [
        j?.large_capsules ?? [],
        j?.featured_win ?? [],
        j?.featured_mac ?? [],
        j?.featured_linux ?? [],
      ];
      for (const arr of buckets) ingest(arr);
    }

    if (!out.length) {
      return NextResponse.json({ ok: false, error: "No catalog data from Steam" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, cc, candidates: out.slice(0, 500) }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
