import { prisma } from '../lib/prisma.js';

/**
 * Music Catalog Bot
 * Searches for songs from configured sources and adds them to the catalog.
 * Sources:
 * - Archive.org (Internet Archive) — public domain and CC-licensed audio
 * - Free Music Archive (FMA) — CC-licensed music
 */

const MAX_DURATION_SECONDS = 300; // 5 minutes max per client requirement
const ARCHIVE_ORG_SEARCH_URL = 'https://archive.org/advancedsearch.php';
const ARCHIVE_ORG_METADATA_URL = 'https://archive.org/metadata';
const ARCHIVE_ORG_DOWNLOAD_URL = 'https://archive.org/download';
const FMA_API_URL = 'https://freemusicarchive.org/api/get/tracks.json';

interface SongMetadata {
  title: string;
  artist: string;
  album?: string;
  genre: string;
  duration: number; // seconds
  fileUrl: string;
  coverArtUrl?: string;
  format: 'MP3' | 'MP4';
  fileSize: number;
}

interface SearchResult {
  songs: SongMetadata[];
  source: string;
  total: number;
}

interface ArchiveOrgSearchDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
  description?: string;
  subject?: string | string[];
}

interface ArchiveOrgFile {
  name: string;
  format?: string;
  length?: string;
  size?: string;
  title?: string;
  creator?: string;
}

interface ArchiveOrgMetadata {
  metadata?: {
    title?: string;
    creator?: string | string[];
    subject?: string | string[];
    description?: string;
  };
  files?: ArchiveOrgFile[];
}

// ============================================
// Source: Archive.org (Internet Archive)
// ============================================

/**
 * Extract the first string value from a field that may be a string or string array
 */
function extractString(value: string | string[] | undefined, fallback = ''): string {
  if (!value) return fallback;
  if (Array.isArray(value)) return value[0] || fallback;
  return value;
}

/**
 * Extract genre from the subject field. Subject can be a string, an array of strings,
 * or a semicolon/comma-separated string.
 */
function extractGenre(subject: string | string[] | undefined): string {
  if (!subject) return 'Other';
  const subjects = Array.isArray(subject)
    ? subject
    : subject.split(/[;,]/).map((s) => s.trim());
  // Return the first non-empty subject as genre, or 'Other'
  return subjects.find((s) => s.length > 0) || 'Other';
}

/**
 * Parse a duration string (e.g., "3:45" or "225.5") into seconds
 */
function parseDuration(length: string | undefined, fileSize?: string): number {
  if (!length) {
    // Estimate from file size if available (assume ~128kbps MP3 = 16KB/s)
    if (fileSize) {
      const bytes = parseInt(fileSize, 10);
      if (!isNaN(bytes)) return Math.round(bytes / 16000);
    }
    return 0;
  }
  // Format "MM:SS" or "H:MM:SS"
  if (length.includes(':')) {
    const parts = length.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  // Format: seconds as decimal
  const secs = parseFloat(length);
  return isNaN(secs) ? 0 : Math.round(secs);
}

/**
 * Find the first MP3 file from an archive.org item's file list
 */
function findMp3File(files: ArchiveOrgFile[]): ArchiveOrgFile | null {
  return files.find(
    (f) =>
      f.format?.toUpperCase() === 'MP3' ||
      f.format?.toUpperCase() === 'VBR MP3' ||
      f.format?.toUpperCase() === '128KBPS MP3' ||
      f.name?.toLowerCase().endsWith('.mp3'),
  ) || null;
}

/**
 * Find a cover art image from an archive.org item's file list
 */
function findCoverArt(files: ArchiveOrgFile[], identifier: string): string | null {
  const imageFile = files.find(
    (f) =>
      f.format?.toUpperCase() === 'JPEG' ||
      f.format?.toUpperCase() === 'PNG' ||
      f.format?.toUpperCase() === 'ITEM IMAGE' ||
      f.name?.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/),
  );
  if (imageFile) {
    return `${ARCHIVE_ORG_DOWNLOAD_URL}/${identifier}/${encodeURIComponent(imageFile.name)}`;
  }
  // Fall back to the archive.org thumbnail service
  return `https://archive.org/services/img/${identifier}`;
}

/**
 * Search Archive.org for audio content matching the query.
 * Uses fuzzy matching via archive.org's full-text search — works with partial/misspelled names.
 */
async function searchArchiveOrg(query: string, genre?: string, limit = 20): Promise<SearchResult> {
  const songs: SongMetadata[] = [];

  try {
    // Build search query — archive.org supports partial/fuzzy matching by default
    let searchQuery = query
      ? `title:(${query}) AND mediatype:audio`
      : 'mediatype:audio AND subject:(music)';

    if (genre) {
      searchQuery += ` AND subject:(${genre})`;
    }

    const searchParams = new URLSearchParams({
      q: searchQuery,
      'fl[]': 'identifier,title,creator,description,subject',
      rows: String(Math.min(limit * 2, 40)), // fetch extra to account for filtering
      output: 'json',
    });

    const searchUrl = `${ARCHIVE_ORG_SEARCH_URL}?${searchParams.toString()}`;
    const searchResponse = await fetch(searchUrl, {
      headers: { 'User-Agent': 'JukeBox-CatalogBot/1.0' },
      signal: globalThis.AbortSignal.timeout(15000),
    });

    if (!searchResponse.ok) {
      console.error(`Archive.org search failed with status ${searchResponse.status}`);
      return { songs: [], source: 'archive.org', total: 0 };
    }

    const searchData = await searchResponse.json() as {
      response?: { docs?: ArchiveOrgSearchDoc[]; numFound?: number };
    };
    const docs = searchData.response?.docs || [];

    // Fetch metadata for each result in parallel
    const metadataPromises = docs.map(async (doc: ArchiveOrgSearchDoc): Promise<SongMetadata | null> => {
      try {
        const metaResponse = await fetch(`${ARCHIVE_ORG_METADATA_URL}/${doc.identifier}`, {
          headers: { 'User-Agent': 'JukeBox-CatalogBot/1.0' },
          signal: globalThis.AbortSignal.timeout(10000),
        });

        if (!metaResponse.ok) return null;

        const meta = await metaResponse.json() as ArchiveOrgMetadata;
        const files = meta.files || [];
        const mp3File = findMp3File(files);

        // Skip items without MP3 files
        if (!mp3File) return null;

        const duration = parseDuration(mp3File.length, mp3File.size);

        // Filter out songs longer than 6 minutes
        if (duration > MAX_DURATION_SECONDS) return null;
        // Skip if duration is 0 (unknown) — we can't reliably play it
        if (duration === 0) return null;

        const title = mp3File.title
          || meta.metadata?.title
          || doc.title
          || 'Unknown Title';
        const artist = extractString(
          mp3File.creator
            ? mp3File.creator
            : meta.metadata?.creator,
          extractString(doc.creator, 'Unknown Artist'),
        );
        const genreValue = genre || extractGenre(meta.metadata?.subject || doc.subject);
        const fileSize = mp3File.size ? parseInt(mp3File.size, 10) : 0;
        const coverArtUrl = findCoverArt(files, doc.identifier);

        return {
          title,
          artist,
          genre: genreValue,
          duration,
          fileUrl: `${ARCHIVE_ORG_DOWNLOAD_URL}/${doc.identifier}/${encodeURIComponent(mp3File.name)}`,
          coverArtUrl: coverArtUrl || undefined,
          format: 'MP3' as const,
          fileSize: isNaN(fileSize) ? 0 : fileSize,
        };
      } catch {
        // Silently skip items that fail metadata fetch
        return null;
      }
    });

    const results = await Promise.allSettled(metadataPromises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        songs.push(result.value);
        if (songs.length >= limit) break;
      }
    }
  } catch (err: any) {
    console.error(`Archive.org search error: ${err.message}`);
  }

  return {
    songs,
    source: 'archive.org',
    total: songs.length,
  };
}

// ============================================
// Source: Free Music Archive (FMA)
// ============================================

/**
 * Search Free Music Archive for tracks.
 * FMA provides CC-licensed music suitable for public playback.
 * Note: FMA API may require an API key in some configurations.
 */
async function searchFreeMusicArchive(query: string, genre?: string, limit = 20): Promise<SearchResult> {
  const songs: SongMetadata[] = [];

  try {
    const params = new URLSearchParams({
      search: query || '',
      limit: String(limit),
    });

    if (genre) {
      params.set('genre_title', genre);
    }

    const response = await fetch(`${FMA_API_URL}?${params.toString()}`, {
      headers: { 'User-Agent': 'JukeBox-CatalogBot/1.0' },
      signal: globalThis.AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`FMA search failed with status ${response.status}`);
      return { songs: [], source: 'freemusicarchive.org', total: 0 };
    }

    const data = await response.json() as {
      dataset?: Array<{
        track_title?: string;
        artist_name?: string;
        album_title?: string;
        track_genres?: Array<{ genre_title?: string }>;
        track_duration?: string;
        track_file?: string;
        track_image_file?: string;
      }>;
      total?: string;
    };

    const tracks = data.dataset || [];

    for (const track of tracks) {
      if (!track.track_file) continue;

      const duration = parseDuration(track.track_duration);
      if (duration > MAX_DURATION_SECONDS || duration === 0) continue;

      const genreValue = genre
        || track.track_genres?.[0]?.genre_title
        || 'Other';

      songs.push({
        title: track.track_title || 'Unknown Title',
        artist: track.artist_name || 'Unknown Artist',
        album: track.album_title,
        genre: genreValue,
        duration,
        fileUrl: track.track_file,
        coverArtUrl: track.track_image_file || undefined,
        format: 'MP3',
        fileSize: 0, // FMA API doesn't always provide file size
      });

      if (songs.length >= limit) break;
    }
  } catch (err: any) {
    console.error(`FMA search error: ${err.message}`);
  }

  return {
    songs,
    source: 'freemusicarchive.org',
    total: songs.length,
  };
}

// ============================================
// Multi-source search
// ============================================

/**
 * Search multiple sources in parallel and combine results.
 * Currently searches Archive.org and Free Music Archive.
 * Results are deduplicated by title+artist (case-insensitive).
 */
export async function searchMultipleSources(
  query: string,
  options: { genre?: string; limit?: number } = {},
): Promise<SearchResult> {
  const { genre, limit = 20 } = options;

  const [archiveResults, fmaResults] = await Promise.allSettled([
    searchArchiveOrg(query, genre, limit),
    searchFreeMusicArchive(query, genre, limit),
  ]);

  const allSongs: SongMetadata[] = [];
  const seen = new Set<string>();
  const sources: string[] = [];

  // Helper to add songs with deduplication
  const addSongs = (result: PromiseSettledResult<SearchResult>) => {
    if (result.status !== 'fulfilled') return;
    sources.push(result.value.source);
    for (const song of result.value.songs) {
      const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        allSongs.push(song);
      }
    }
  };

  addSongs(archiveResults);
  addSongs(fmaResults);

  return {
    songs: allSongs.slice(0, limit),
    source: sources.join('+'),
    total: allSongs.length,
  };
}

// ============================================
// Main catalog bot functions
// ============================================

/**
 * Search for songs across configured sources
 */
export async function searchCatalog(
  query: string,
  options: { genre?: string; limit?: number } = {},
): Promise<SearchResult> {
  const { genre, limit = 20 } = options;

  // Primary source: Archive.org
  const results = await searchArchiveOrg(query, genre, limit);

  return results;
}

/**
 * Import songs from search results into the local catalog
 */
export async function importSongs(
  songs: SongMetadata[],
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const song of songs) {
    try {
      // Check if song already exists (by title + artist)
      const existing = await prisma.song.findFirst({
        where: {
          title: song.title,
          artist: song.artist,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.song.create({
        data: {
          title: song.title,
          artist: song.artist,
          album: song.album || null,
          genre: song.genre,
          duration: song.duration,
          fileUrl: song.fileUrl,
          coverArtUrl: song.coverArtUrl || null,
          format: song.format,
          fileSize: song.fileSize,
          isActive: true,
          metadata: { source: 'catalog-bot', importedAt: new Date().toISOString() },
        },
      });

      imported++;
    } catch (err: any) {
      errors.push(`Failed to import "${song.title}" by ${song.artist}: ${err.message}`);
    }
  }

  return { imported, skipped, errors };
}

/**
 * Auto-populate catalog from configured sources
 * Called by admin or on a schedule
 */
export async function autoPopulateCatalog(options: {
  genres?: string[];
  maxPerGenre?: number;
} = {}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { genres = ['Sertanejo', 'Rock', 'Pop', 'Funk', 'Samba', 'MPB', 'Bossa Nova', 'Forró', 'Pagode'], maxPerGenre = 10 } = options;

  let totalImported = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];

  for (const genre of genres) {
    const results = await searchCatalog('', { genre, limit: maxPerGenre });
    const { imported, skipped, errors } = await importSongs(results.songs);
    totalImported += imported;
    totalSkipped += skipped;
    allErrors.push(...errors);
  }

  return {
    imported: totalImported,
    skipped: totalSkipped,
    errors: allErrors,
  };
}

/**
 * Handle a song request from a customer
 * Searches external sources and potentially imports the song
 */
export async function handleSongRequest(
  requestId: string,
): Promise<{ found: boolean; songId?: string; message: string }> {
  const songRequest = await prisma.songRequest.findUnique({
    where: { id: requestId },
  });

  if (!songRequest) {
    return { found: false, message: 'Request not found' };
  }

  // Search for the song
  const results = await searchCatalog(`${songRequest.title} ${songRequest.artist}`);

  if (results.songs.length === 0) {
    return { found: false, message: `No results found for "${songRequest.title}" by ${songRequest.artist}` };
  }

  // Import the first match
  const { imported, errors } = await importSongs([results.songs[0]]);

  if (imported > 0) {
    // Find the newly imported song
    const song = await prisma.song.findFirst({
      where: { title: results.songs[0].title, artist: results.songs[0].artist },
    });

    // Mark request as handled
    await prisma.songRequest.update({
      where: { id: requestId },
      data: { isHandled: true },
    });

    return {
      found: true,
      songId: song?.id,
      message: `Imported "${results.songs[0].title}" by ${results.songs[0].artist}`,
    };
  }

  return {
    found: false,
    message: errors.length > 0 ? errors[0] : 'Failed to import song',
  };
}
