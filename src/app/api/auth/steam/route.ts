// app/api/auth/steam/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const base = process.env.BASE_URL || "https://steampicker.plazor.xyz";

  // Construct OpenID request
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${base}/api/auth/steam/callback`,
    "openid.realm": base,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  return NextResponse.redirect(
    `https://steamcommunity.com/openid/login?${params.toString()}`
  );
}
