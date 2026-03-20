/**
 * Encode/decode roast card data for shareable URLs.
 * Data is JSON → base64url encoded (no padding, URL-safe).
 */

export type ShareableRoast = {
  // Profile
  n: string;   // personaName
  a: string;   // avatarUrl
  g: number;   // totalGames
  h: number;   // totalHours
  u: number;   // neverPlayed
  v: string;   // libraryValue display string (e.g. "₹2,19,225.00")
  vn: number;  // libraryValueNum
  cs: string;  // currencySymbol
  // Roast
  hl: string;  // headline
  ln: string[]; // lines
  rt: string;  // rating
  gr: string;  // grade
  gc: string;  // gradeColor
  // Shame game (optional)
  sg?: { n: string; h: number; img: string };
};

export function encodeRoast(data: ShareableRoast): string {
  const json = JSON.stringify(data);
  // btoa doesn't handle unicode — use TextEncoder
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeRoast(encoded: string): ShareableRoast | null {
  try {
    // Restore base64 padding
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
