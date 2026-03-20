import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ steamId: string }> }
): Promise<Metadata> {
  const { steamId } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://steampicker.plazor.xyz";
  const ogImage = `${siteUrl}/api/og?id=${steamId}`;
  return {
    title: "Steam Profile Roast — SteamPicker",
    description: "See this Steam profile get roasted. Get yours at SteamPicker.",
    openGraph: {
      title: "Steam Profile Roast — SteamPicker",
      description: "See this Steam profile get roasted. Get yours at SteamPicker.",
      url: `${siteUrl}/roast/${steamId}`,
      siteName: "SteamPicker",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [ogImage] },
  };
}

export default async function RoastSharePage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://steampicker.plazor.xyz";
  const ogImage = `${siteUrl}/api/og?id=${steamId}`;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6">
      <img
        src={ogImage}
        alt="Steam Profile Roast"
        className="w-full max-w-[720px] rounded-2xl border border-white/[0.08]"
      />
      <div className="mt-8 flex flex-col items-center gap-4">
        <a
          href={`/profile/${steamId}`}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-base hover:from-blue-400 hover:to-indigo-400 transition-all"
        >
          View Full Profile
        </a>
        <a href="/" className="text-gray-500 text-sm hover:text-blue-400 transition-colors">
          Get your own roast at <span className="text-blue-400">SteamPicker</span>
        </a>
      </div>
    </main>
  );
}
