---
name: project_status
description: Current state of SteamPicker as of 2026-03-19 — what's broken, what works, what needs fixing before launch
type: project
---

## SteamPicker Status — March 19, 2026

### What Works
- Landing page with beams background, sale calendar (Valve API), Steam login
- Profile page loads with stats, recently played, all games browser
- Recommendation engine uses Steam's "More Like This" collaborative filtering (much better than tag matching)
- Roast card with download/share functionality
- Tag-based sidebar filters for games

### Known Bugs to Fix
1. **Library value not loading on Vercel** — new POST `/api/steam/value` route was just created but not tested on Vercel. Old GET route at `/api/steam/value/[steamId]` still exists and may conflict
2. **Missing thumbnails on some rec cards** — price proxy now fetches `basic` filter which should fix this, but untested
3. **CC detection** — new `/api/steam/geo` route created but the whole CC flow needs end-to-end testing. User is in India, prices should show ₹
4. **Prices showing "View on store"** — proxy route at `/api/steam/prices` handles CORS but needs verification
5. **Some games show as "App XXXXX"** — catalog enrichment uses SteamSpy → Steam API fallback, ~99 games still miss names
6. **Roast card PNG download** — html2canvas lab() color crash workaround (clone into detached container) needs testing
7. **Vercel deployment 404** — needs fresh deploy after all changes

### Architecture Summary
- **Prices**: Steam `appdetails` API with `?cc=` for regional pricing (server-side only, no CORS)
- **Recommendations**: Steam's "More Like This" endpoint per anchor game → score by overlap
- **Tags/enrichment**: SteamSpy for tags, Steam store page scraping as fallback
- **Value calculation**: POST `/api/steam/value` with appids, batches of 100
- **Geo detection**: `/api/steam/geo` server proxy for IP geolocation

### Files Changed (key ones)
- `src/app/api/steam/value/route.ts` — NEW POST route for fast value calc
- `src/app/api/steam/prices/route.ts` — NEW proxy for Steam appdetails (CORS)
- `src/app/api/steam/geo/route.ts` — NEW server-side geo detection
- `src/app/api/steam/catalog/route.ts` — Uses Steam "More Like This"
- `src/app/api/steam/enrich/route.ts` — SteamSpy + store page scraping
- `src/lib/prescreener.ts` — v7 game-centric recommendation engine
- `src/lib/roast.ts` — Roast text generator
- `src/app/profile/[steamId]/page.tsx` — Main profile page
- `src/components/RoastCard.tsx` — 800x800 roast card
- `src/components/RoastCardModal.tsx` — Download/share modal

**Why:** Steam Spring Sale timing — needs to be live ASAP.
**How to apply:** Fix bugs top-down, deploy to Vercel, test with multiple profiles.
