import { prisma } from '../lib/prisma.js';
import { exec } from 'child_process';
import { existsSync, mkdirSync, statSync } from 'fs';
import { resolve } from 'path';

/**
 * Music Catalog Bot
 * Searches for songs from configured sources and adds them to the catalog.
 * Sources:
 * - Archive.org (Internet Archive) — public domain and CC-licensed audio
 * - Free Music Archive (FMA) — CC-licensed music
 * - YouTube (via YouTube Data API v3 or HTML scraping fallback)
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
// Source: YouTube (via Data API v3 or HTML scraping)
// ============================================

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_SEARCH_URL = 'https://www.youtube.com/results';
const UPLOADS_DIR = resolve(process.cwd(), 'uploads', 'music');

/**
 * Clean up a YouTube video title by removing common suffixes
 */
function cleanYouTubeTitle(title: string): string {
  return title
    .replace(/\s*[\(\[]\s*(Official\s*)?(Music\s*)?(Video|Audio|Lyrics|Lyric Video|Visualizer|MV|M\/V|HD|HQ|4K|Live)\s*[\)\]]/gi, '')
    .replace(/\s*-\s*(Official\s*)?(Music\s*)?(Video|Audio|Lyrics|Lyric Video|Visualizer|MV|M\/V)\s*$/gi, '')
    .replace(/\s*\|\s*(Official\s*)?(Music\s*)?(Video|Audio|Lyrics)\s*$/gi, '')
    .replace(/\s*ft\.?\s+.*$/i, (match) => match) // keep featuring info
    .trim();
}

/**
 * Search YouTube using the Data API v3
 */
async function searchYouTubeAPI(query: string, apiKey: string, limit = 10): Promise<SongMetadata[]> {
  const params = new URLSearchParams({
    q: query,
    type: 'video',
    videoCategoryId: '10', // Music category
    maxResults: String(limit),
    part: 'snippet',
    key: apiKey,
  });

  const response = await fetch(`${YOUTUBE_API_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'JukeBox-CatalogBot/1.0' },
    signal: globalThis.AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    console.error(`YouTube API search failed with status ${response.status}`);
    return [];
  }

  const data = await response.json() as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
    }>;
  };

  const songs: SongMetadata[] = [];
  for (const item of data.items || []) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;

    const snippet = item.snippet || {};
    const thumbnail =
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    songs.push({
      title: cleanYouTubeTitle(snippet.title || 'Unknown Title'),
      artist: snippet.channelTitle || 'Unknown Artist',
      genre: 'Other',
      duration: 0,
      fileUrl: '', // filled after download
      coverArtUrl: thumbnail,
      format: 'MP3',
      fileSize: 0,
    });
  }

  return songs;
}

/**
 * Fallback: scrape YouTube's public search page for video IDs when no API key is available.
 * This is a best-effort approach and may break if YouTube changes their HTML.
 */
async function searchYouTubeScrape(query: string, limit = 10): Promise<SongMetadata[]> {
  const params = new URLSearchParams({ search_query: query });
  const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: globalThis.AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    console.error(`YouTube scrape search failed with status ${response.status}`);
    return [];
  }

  const html = await response.text();

  // Extract video IDs from the HTML — YouTube embeds JSON data in a script tag
  const songs: SongMetadata[] = [];
  const seen = new Set<string>();

  // Pattern 1: extract from ytInitialData JSON
  const jsonMatch = html.match(/var ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
  if (jsonMatch) {
    try {
      const ytData = JSON.parse(jsonMatch[1]);
      const contents =
        ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;

      if (Array.isArray(contents)) {
        for (const section of contents) {
          const items = section?.itemSectionRenderer?.contents;
          if (!Array.isArray(items)) continue;

          for (const item of items) {
            const renderer = item?.videoRenderer;
            if (!renderer?.videoId) continue;

            const videoId = renderer.videoId as string;
            if (seen.has(videoId)) continue;
            seen.add(videoId);

            const title = renderer.title?.runs?.[0]?.text || 'Unknown Title';
            const channel = renderer.ownerText?.runs?.[0]?.text || 'Unknown Artist';

            songs.push({
              title: cleanYouTubeTitle(title),
              artist: channel,
              genre: 'Other',
              duration: 0,
              fileUrl: '',
              coverArtUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              format: 'MP3',
              fileSize: 0,
            });

            if (songs.length >= limit) break;
          }
          if (songs.length >= limit) break;
        }
      }
    } catch {
      // JSON parse failed, fall through to regex
    }
  }

  // Pattern 2: regex fallback for video IDs in HTML
  if (songs.length === 0) {
    const videoIdRegex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
    let match: RegExpExecArray | null;
    while ((match = videoIdRegex.exec(html)) !== null && songs.length < limit) {
      const videoId = match[1];
      if (seen.has(videoId)) continue;
      seen.add(videoId);

      songs.push({
        title: `YouTube Video ${videoId}`,
        artist: 'Unknown Artist',
        genre: 'Other',
        duration: 0,
        fileUrl: '',
        coverArtUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        format: 'MP3',
        fileSize: 0,
      });
    }
  }

  return songs;
}

/**
 * Search YouTube for music videos.
 * Uses YouTube Data API v3 if YOUTUBE_API_KEY is set, otherwise falls back to HTML scraping.
 */
export async function searchYouTube(query: string, limit = 10): Promise<SearchResult> {
  const songs: SongMetadata[] = [];

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    let results: SongMetadata[];

    if (apiKey) {
      results = await searchYouTubeAPI(query, apiKey, limit);
    } else {
      results = await searchYouTubeScrape(query, limit);
    }

    songs.push(...results.slice(0, limit));
  } catch (err: any) {
    console.error(`YouTube search error: ${err.message}`);
  }

  return {
    songs,
    source: 'youtube',
    total: songs.length,
  };
}

/**
 * Execute a shell command with a timeout, returning a promise
 */
function execPromise(command: string, timeoutMs = 60000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = exec(command, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: stdout?.toString() || '', stderr: stderr?.toString() || '' });
    });
    // Ensure process is killed on timeout
    proc.on('error', reject);
  });
}

/**
 * Download audio from a YouTube video using yt-dlp.
 * Requires yt-dlp to be installed on the system (apt install yt-dlp or pip install yt-dlp).
 *
 * @param videoId - YouTube video ID
 * @returns Local file path to the downloaded MP3
 * @throws Error if download fails, times out, or video exceeds max duration
 */
export async function downloadFromYouTube(videoId: string): Promise<string> {
  // Ensure uploads directory exists
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const outputPath = resolve(UPLOADS_DIR, `${videoId}.mp3`);

  // If already downloaded, return the existing file
  if (existsSync(outputPath)) {
    return `/uploads/music/${videoId}.mp3`;
  }

  // First, check video duration to enforce max duration filter
  try {
    const { stdout: durationStr } = await execPromise(
      `yt-dlp --print duration "https://www.youtube.com/watch?v=${videoId}"`,
      15000,
    );
    const duration = parseFloat(durationStr.trim());
    if (!isNaN(duration) && duration > MAX_DURATION_SECONDS) {
      throw new Error(
        `Video duration (${Math.round(duration)}s) exceeds maximum allowed (${MAX_DURATION_SECONDS}s)`,
      );
    }
  } catch (err: any) {
    // If the error is our duration check, re-throw it
    if (err.message?.includes('exceeds maximum')) throw err;
    // Otherwise, log and continue — duration check is best-effort
    console.warn(`Could not check video duration: ${err.message}`);
  }

  // Download audio as MP3
  const command = [
    'yt-dlp',
    '-x',
    '--audio-format mp3',
    '--audio-quality 128K',
    '--no-playlist',
    '--no-overwrites',
    `-o "${outputPath}"`,
    `"https://www.youtube.com/watch?v=${videoId}"`,
  ].join(' ');

  await execPromise(command, 60000);

  // Verify file was created
  if (!existsSync(outputPath)) {
    throw new Error(`Download completed but file not found at ${outputPath}`);
  }

  return `/uploads/music/${videoId}.mp3`;
}

/**
 * Download audio from YouTube and import it into the database as a Song.
 *
 * @param videoId - YouTube video ID
 * @param metadata - Song metadata (title, artist, genre)
 * @returns The created Song record
 */
export async function downloadAndImportFromYouTube(
  videoId: string,
  metadata: { title: string; artist: string; genre?: string },
) {
  // Check if song already exists by title + artist
  const existing = await prisma.song.findFirst({
    where: { title: metadata.title, artist: metadata.artist },
  });
  if (existing) {
    return existing;
  }

  // Download the audio
  const fileUrl = await downloadFromYouTube(videoId);

  // Get file size
  const absolutePath = resolve(process.cwd(), fileUrl.replace(/^\//, ''));
  let fileSize = 0;
  try {
    const stats = statSync(absolutePath);
    fileSize = stats.size;
  } catch {
    // file size unknown
  }

  // Estimate duration from file size (128kbps = 16KB/s)
  const duration = fileSize > 0 ? Math.round(fileSize / 16000) : 0;

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Create the song record
  const song = await prisma.song.create({
    data: {
      title: metadata.title,
      artist: metadata.artist,
      genre: metadata.genre || 'Other',
      duration,
      fileUrl,
      originalFileUrl: youtubeUrl,
      coverArtUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      format: 'MP3',
      fileSize,
      isActive: true,
      metadata: {
        source: 'youtube',
        videoId,
        importedAt: new Date().toISOString(),
      },
    },
  });

  return song;
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

  // Also search YouTube if enabled
  const youtubeEnabled =
    !!process.env.YOUTUBE_API_KEY || process.env.ENABLE_YOUTUBE_SEARCH === 'true';
  if (youtubeEnabled && query) {
    try {
      const ytResults = await searchYouTube(query, limit);
      const seen = new Set(
        results.songs.map((s) => `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`),
      );
      for (const song of ytResults.songs) {
        const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.songs.push(song);
        }
      }
      results.source = results.source ? `${results.source}+youtube` : 'youtube';
      results.total = results.songs.length;
    } catch (err: any) {
      console.error(`YouTube search in catalog failed: ${err.message}`);
    }
  }

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
