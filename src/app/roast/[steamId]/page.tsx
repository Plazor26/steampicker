import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ steamId: string }> }
): Promise<Metadata> {
  const { steamId } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://steampicker.plazor.xyz";
  return {
    title: "Steam Profile Roast — SteamPicker",
    description: "See this Steam profile get roasted. Get yours at SteamPicker.",
    openGraph: {
      title: "Steam Profile Roast — SteamPicker",
      description: "See this Steam profile get roasted. Get yours at SteamPicker.",
      url: `${siteUrl}/roast/${steamId}`,
      siteName: "SteamPicker",
      type: "website",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RoastSharePage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://steampicker.plazor.xyz";
  const ogImageUrl = `${siteUrl}/roast/${steamId}/opengraph-image`;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050a14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "sans-serif",
      }}
    >
      {/* Roast card image */}
      <img
        src={ogImageUrl}
        alt="Steam Profile Roast"
        style={{
          width: "100%",
          maxWidth: 720,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />

      {/* CTA */}
      <div
        style={{
          marginTop: 32,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <a
          href={`/profile/${steamId}`}
          style={{
            padding: "12px 32px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            color: "white",
            fontWeight: 700,
            fontSize: 16,
            textDecoration: "none",
          }}
        >
          View Full Profile
        </a>
        <a
          href="/"
          style={{
            color: "#64748b",
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Get your own roast at <span style={{ color: "#3b82f6" }}>SteamPicker</span>
        </a>
      </div>
    </main>
  );
}
