import type { Metadata } from "next";
import { redirect } from "next/navigation";

export async function generateMetadata(
  { params }: { params: Promise<{ steamId: string }> }
): Promise<Metadata> {
  const { steamId } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://steampicker.plazor.xyz";
  return {
    title: "Steam Profile Roast — SteamPicker",
    description: "See this Steam profile roasted. Get yours at SteamPicker.",
    openGraph: {
      title: "Steam Profile Roast — SteamPicker",
      description: "See this Steam profile roasted. Get yours at SteamPicker.",
      url: `${siteUrl}/roast/${steamId}`,
      siteName: "SteamPicker",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function RoastSharePage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = await params;
  redirect(`/profile/${steamId}`);
}
