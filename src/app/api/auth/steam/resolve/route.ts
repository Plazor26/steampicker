import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { input } = await req.json();

  // Extract vanity or ID
  let vanity: string | null = null;
  const vanityMatch = input.match(/\/id\/([^/]+)/);
  const profileMatch = input.match(/\/profiles\/(\d{17})/);

  if (profileMatch) {
    return NextResponse.json({ steamId: profileMatch[1] });
  } else if (vanityMatch) {
    vanity = vanityMatch[1];
  } else if (/^\d{17}$/.test(input)) {
    return NextResponse.json({ steamId: input });
  } else {
    // Treat any other string as a potential vanity URL
    vanity = input.trim();
  }


  if (!vanity) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const key = process.env.STEAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "STEAM_API_KEY is not configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(vanity)}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Steam API error (${res.status})` }, { status: 502 });
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Invalid response from Steam API" }, { status: 502 });
  }

  if (data.response?.success !== 1) {
    return NextResponse.json({ error: "Could not find that Steam profile" }, { status: 404 });
  }

  return NextResponse.json({ steamId: data.response.steamid });
}
