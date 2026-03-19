import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side IP geolocation. Tries multiple free services.
 * The browser can't call these directly (CORS), so we proxy server-side.
 */
export async function GET(req: NextRequest) {
  // 1. Try Vercel/Cloudflare geo headers (works in production)
  const headerCC = req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-forwarded-country") ||
    req.headers.get("cf-ipcountry");
  if (headerCC) {
    return NextResponse.json({ cc: headerCC.toUpperCase() });
  }

  // 2. Try free IP geo services (for local dev)
  const services = [
    { url: "https://freeipapi.com/api/json", extract: (j: any) => j?.countryCode },
    { url: "https://ipapi.co/country/", extract: (_: any, text: string) => text?.trim() },
    { url: "https://ipwho.is/", extract: (j: any) => j?.country_code },
  ];

  for (const svc of services) {
    try {
      const r = await fetch(svc.url, { cache: "no-store" });
      if (!r.ok) continue;
      const text = await r.text();
      let cc: string | undefined;
      try { cc = svc.extract(JSON.parse(text), text); } catch { cc = svc.extract(null, text); }
      if (cc && /^[A-Z]{2}$/i.test(cc)) {
        return NextResponse.json({ cc: cc.toUpperCase() });
      }
    } catch { continue; }
  }

  return NextResponse.json({ cc: null });
}
