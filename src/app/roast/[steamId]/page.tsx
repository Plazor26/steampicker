import type { Metadata } from "next";
import { decodeRoast } from "@/lib/roastShare";
import RoastShareCard from "./RoastShareCard";

const STEAM_KEY = process.env.STEAM_API_KEY || "";

async function fetchBasicProfile(steamId: string) {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_KEY}&steamids=${steamId}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    const p = data?.response?.players?.[0];
    return { name: p?.personaname || "Steam Player", avatar: p?.avatarfull || "" };
  } catch {
    return { name: "Steam Player", avatar: "" };
  }
}

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ steamId: string }>;
  searchParams: Promise<{ d?: string }>;
}): Promise<Metadata> {
  const { steamId } = await params;
  const { d } = await searchParams;
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://steampicker.plazor.xyz";
  const ogImage = `${siteUrl}/api/og?id=${steamId}`;

  let title = "Steam Profile Roast — SteamPicker";
  if (d) {
    const roast = decodeRoast(d);
    if (roast) {
      title = `${roast.n}'s Steam Roast: Grade ${roast.gr} (${roast.rt})`;
    }
  }

  return {
    title,
    description: "See this Steam profile get roasted. Get yours at SteamPicker.",
    openGraph: {
      title,
      description: "See this Steam profile get roasted. Get yours at SteamPicker.",
      url: `${siteUrl}/roast/${steamId}`,
      siteName: "SteamPicker",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [ogImage] },
  };
}

export default async function RoastSharePage({ params, searchParams }: {
  params: Promise<{ steamId: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { steamId } = await params;
  const { d } = await searchParams;
  const roast = d ? decodeRoast(d) : null;

  // If no encoded data, show basic card from Steam API
  if (!roast) {
    const profile = await fetchBasicProfile(steamId);
    return (
      <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[640px] rounded-2xl border border-white/[0.08] p-8 text-center" style={{ background: "linear-gradient(145deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)" }}>
          {profile.avatar && <img src={profile.avatar} width={72} height={72} className="rounded-2xl mx-auto mb-4" alt="" />}
          <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
          <p className="text-gray-500 mt-2">This roast has expired or the link is invalid.</p>
          <a href={`/profile/${steamId}`} className="inline-block mt-6 px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors">
            Generate a new roast
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6">
      <RoastShareCard roast={roast} steamId={steamId} />
      <div className="mt-8 flex flex-col items-center gap-4">
        <a href={`/profile/${steamId}`} className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold hover:from-blue-400 hover:to-indigo-400 transition-all">
          View Full Profile
        </a>
        <a href="/" className="text-gray-500 text-sm hover:text-blue-400 transition-colors">
          Get your own roast at <span className="text-blue-400">SteamPicker</span>
        </a>
      </div>
    </main>
  );
}
