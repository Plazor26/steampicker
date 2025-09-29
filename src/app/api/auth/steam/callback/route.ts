import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Extract params returned from Steam
  const searchParams = url.searchParams;
  const claimedId = searchParams.get("openid.claimed_id");

  if (!claimedId) {
    return NextResponse.json({ error: "No claimed_id returned" }, { status: 400 });
  }

  // SteamID is the last segment of claimed_id
  const steamIdMatch = claimedId.match(/\/(\d+)$/);
  if (!steamIdMatch) {
    return NextResponse.json({ error: "Invalid claimed_id" }, { status: 400 });
  }

  const steamId = steamIdMatch[1];

  return NextResponse.redirect(`${baseUrl}/profile/${steamId}`);
}
