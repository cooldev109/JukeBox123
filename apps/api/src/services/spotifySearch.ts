// ============================================
// Spotify Metadata Search Service
// Uses Client Credentials flow (no user login)
// ============================================

export interface SpotifyTrack {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number; // seconds
  coverArtUrl: string;
  previewUrl: string | null;
  spotifyUrl: string;
}

// ---- Token cache ----
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

function getCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error(`[SpotifySearch] Token request failed: ${res.status} ${res.statusText}`);
    cachedToken = null;
    return null;
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ---- Title cleanup ----

/**
 * Remove noise from track titles for cleaner display:
 * "feat.", "ft.", remaster notes, live/version tags, etc.
 */
function cleanTitle(raw: string): string {
  let title = raw;
  // Remove parenthesized/bracketed suffixes like (feat. X), (Remastered 2023), [Deluxe Edition]
  title = title.replace(/\s*[\(\[]\s*(?:feat\.?|ft\.?)\s+[^\)\]]+[\)\]]/gi, '');
  title = title.replace(/\s*[\(\[]\s*(?:Remaster(?:ed)?|Deluxe|Bonus|Anniversary|Edition|Version|Mix|Remix|Live|Demo|Single|Radio Edit|Original)[^\)\]]*[\)\]]/gi, '');
  // Remove inline "feat." / "ft." without parens
  title = title.replace(/\s*[-–—]\s*(?:feat\.?|ft\.?)\s+.+$/i, '');
  return title.trim();
}

// ---- Mapping helpers ----

function mapTrack(item: any): SpotifyTrack {
  const artists = (item.artists || []).map((a: any) => a.name).join(', ');
  const album = item.album || {};
  const images: any[] = album.images || [];
  // Pick the largest image (first) or fallback
  const coverArtUrl = images.length > 0 ? images[0].url : '';

  return {
    spotifyId: item.id,
    title: cleanTitle(item.name || ''),
    artist: artists,
    album: album.name || '',
    genre: 'Other', // Spotify doesn't return genre per track
    duration: Math.round((item.duration_ms || 0) / 1000),
    coverArtUrl,
    previewUrl: item.preview_url || null,
    spotifyUrl: item.external_urls?.spotify || '',
  };
}

// ============================================
// Public API
// ============================================

/**
 * Search Spotify for tracks matching a query string.
 * Returns empty array if credentials are not configured.
 */
export async function searchSpotify(query: string, limit: number = 10): Promise<SpotifyTrack[]> {
  if (!query || query.trim().length === 0) return [];

  const token = await getAccessToken();
  if (!token) return [];

  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(Math.min(Math.max(limit, 1), 50)),
  });

  const res = await fetch(`${API_BASE}/search?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error(`[SpotifySearch] Search failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json() as any;
  const items: any[] = data?.tracks?.items || [];
  return items.map(mapTrack);
}

/**
 * Get a single Spotify track by its ID.
 * Returns null if not found or credentials are not configured.
 */
export async function getSpotifyTrack(trackId: string): Promise<SpotifyTrack | null> {
  if (!trackId) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/tracks/${encodeURIComponent(trackId)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    console.error(`[SpotifySearch] Get track failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const item = await res.json() as any;
  return mapTrack(item);
}
