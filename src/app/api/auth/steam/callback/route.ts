import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // … your Steam OpenID verification logic …

  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Example extracted from the OpenID claimed_id
  const steamId = "76561198993366100";

  return NextResponse.redirect(`${baseUrl}/profile/${steamId}`);
}
