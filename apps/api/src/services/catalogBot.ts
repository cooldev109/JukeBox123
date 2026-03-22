import { prisma } from '../lib/prisma.js';

/**
 * Music Catalog Bot
 * Searches for songs from configured sources and adds them to the catalog.
 * In production, this would integrate with legal music APIs like:
 * - Jamendo (CC music)
 * - Free Music Archive
 * - Spotify API (metadata only, link to licensed streams)
 *
 * For now, this provides the framework and a mock source.
 */

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

// ============================================
// Source: Mock/Demo catalog (for development)
// ============================================
async function searchMockCatalog(query: string, genre?: string, limit = 20): Promise<SearchResult> {
  // In production, replace with actual API calls to legal music sources
  const mockSongs: SongMetadata[] = [
    { title: 'Samba de Janeiro', artist: 'Bellini', genre: 'Samba', duration: 210, fileUrl: 'https://example.com/samba.mp3', format: 'MP3', fileSize: 5000000 },
    { title: 'Ai Se Eu Te Pego', artist: 'Michel Teló', genre: 'Sertanejo', duration: 195, fileUrl: 'https://example.com/aiseeutepego.mp3', format: 'MP3', fileSize: 4800000 },
    { title: 'Garota de Ipanema', artist: 'Tom Jobim', genre: 'Bossa Nova', duration: 312, fileUrl: 'https://example.com/garota.mp3', format: 'MP3', fileSize: 7500000 },
    { title: 'Aquarela do Brasil', artist: 'Ary Barroso', genre: 'MPB', duration: 248, fileUrl: 'https://example.com/aquarela.mp3', format: 'MP3', fileSize: 6000000 },
    { title: 'Mas Que Nada', artist: 'Sergio Mendes', genre: 'Bossa Nova', duration: 180, fileUrl: 'https://example.com/masquenada.mp3', format: 'MP3', fileSize: 4300000 },
  ];

  let results = mockSongs;

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q),
    );
  }

  if (genre) {
    results = results.filter((s) => s.genre.toLowerCase() === genre.toLowerCase());
  }

  return {
    songs: results.slice(0, limit),
    source: 'mock',
    total: results.length,
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

  // For now, only mock source. In production, add more sources.
  const results = await searchMockCatalog(query, genre, limit);

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
