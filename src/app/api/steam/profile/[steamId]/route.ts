import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/steam/profile/:steamId
 * Aggregates player summary, owned games, and recent games.
 * Requires process.env.STEAM_API_KEY
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ steamId: string }> } // <-- await params in Next 15
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

  const base = "https://api.steampowered.com";
  const toJson = (r: Response) => (r.ok ? r.json() : Promise.reject(r));

  try {
    const summaryP = fetch(
      `${base}/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`,
      { cache: "no-store" }
    ).then(toJson);

    const ownedP = fetch(
      `${base}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`,
      { cache: "no-store" }
    ).then(toJson);

    const recentP = fetch(
      `${base}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${steamId}`,
      { cache: "no-store" }
    ).then(toJson);

    const [summaryRaw, ownedRaw, recentRaw] = await Promise.allSettled([
      summaryP,
      ownedP,
      recentP,
    ]);

    let profile: any = null;
    if (summaryRaw.status === "fulfilled") {
      profile = summaryRaw.value?.response?.players?.[0] ?? null;
    }

    const ownedResp =
      ownedRaw.status === "fulfilled" ? ownedRaw.value?.response : null;

    const ownedGames = Array.isArray(ownedResp?.games) ? ownedResp!.games : [];
    const totalGames = typeof ownedResp?.game_count === "number" ? ownedResp!.game_count : null;

    let totalMinutes = 0;
    let neverPlayed = 0;
    for (const g of ownedGames) {
      const m = Number(g.playtime_forever || 0);
      totalMinutes += m;
      if (!m) neverPlayed++;
    }

    const topGames = [...ownedGames]
      .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
      .slice(0, 10)
      .map(mapGame);

    const recentGames =
      recentRaw.status === "fulfilled"
        ? (recentRaw.value?.response?.games ?? []).slice(0, 10).map(mapRecent)
        : [];

    const isPrivate =
      !profile ||
      (Array.isArray(ownedGames) && ownedGames.length === 0 && totalGames === 0);

    // Provide lists used by the Profile page filters:
    const allGames = ownedGames.map(mapGame);                // full mapped list
    const ownedSlim = ownedGames.map((g: any) => ({ appid: g.appid })); // for fast ownership checks

    return NextResponse.json(
      {
        ok: true,
        isPrivate,
        steamId,
        profile: profile
          ? {
              personaName: profile.personaname,
              avatar: profile.avatarfull,
              profileUrl: profile.profileurl,
              country: profile.loccountrycode ?? null,
              state: profile.locstatecode ?? null,
              visibility: profile.communityvisibilitystate, // 1=Private, 3=Public
              lastLogoff: profile.lastlogoff
                ? new Date(profile.lastlogoff * 1000).toISOString()
                : null,
            }
          : null,
        library: {
          totalGames,
          totalMinutes,
          neverPlayed,
          topGames,
          recentGames,
          ownedGames: ownedSlim,
          allGames,
        },
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Steam API error", detail: String(err) },
      { status: 502 }
    );
  }
}

function mapGame(g: any) {
  const appid = g.appid;
  const minutes = Number(g.playtime_forever || 0);
  return {
    appid,
    name: g.name,
    minutes,
    hours: +(minutes / 60).toFixed(1),
    header: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
    logo: g.img_logo_url
      ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${g.img_logo_url}.jpg`
      : null,
    lastPlayedAt: g.rtime_last_played
      ? new Date(g.rtime_last_played * 1000).toISOString()
      : null,
  };
}

function mapRecent(g: any) {
  const appid = g.appid;
  const minutes2w = Number(g.playtime_2weeks || 0);
  const minutes = Number(g.playtime_forever || 0);
  return {
    appid,
    name: g.name,
    minutes2w,
    hours2w: +(minutes2w / 60).toFixed(1),
    minutes,
    hours: +(minutes / 60).toFixed(1),
    header: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
    logo: g.img_logo_url
      ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${g.img_logo_url}.jpg`
      : null,
    lastPlayedAt: g.rtime_last_played
      ? new Date(g.rtime_last_played * 1000).toISOString()
      : null,
  };
}
