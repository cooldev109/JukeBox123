/**
 * Bulk import MP3 files into the JukeBox catalog.
 *
 * Usage:
 *   tsx scripts/bulk-import-songs.ts <source-folder> [--copy] [--dry-run]
 *
 * Examples:
 *   tsx scripts/bulk-import-songs.ts /root/music-library
 *   tsx scripts/bulk-import-songs.ts /root/music-library --copy
 *   tsx scripts/bulk-import-songs.ts /root/music-library --dry-run
 *
 * Behavior:
 *   - Recursively scans the source folder for .mp3 files.
 *   - Reads ID3 tags (title, artist, album, genre, duration) when available.
 *   - Falls back to filename for the title if no ID3 title tag exists.
 *   - Default: moves the file into apps/api/uploads/music/ with a UUID name.
 *   - With --copy: copies instead of moves (keeps the original).
 *   - With --dry-run: lists what would be imported, does NOT touch the DB or filesystem.
 *   - Skips files already imported (matched by SHA-256 of file contents) so re-runs are safe.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface ImportStats {
  scanned: number;
  imported: number;
  skipped: number;
  failed: number;
}

const args = process.argv.slice(2);
const sourceFolder = args.find((a) => !a.startsWith('--'));
const copyMode = args.includes('--copy');
const dryRun = args.includes('--dry-run');

if (!sourceFolder) {
  console.error('Usage: tsx scripts/bulk-import-songs.ts <source-folder> [--copy] [--dry-run]');
  process.exit(1);
}

if (!fs.existsSync(sourceFolder)) {
  console.error(`Source folder does not exist: ${sourceFolder}`);
  process.exit(1);
}

const musicDir = path.join(process.cwd(), 'uploads', 'music');
if (!dryRun && !fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

function findMp3sRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findMp3sRecursive(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) {
      out.push(full);
    }
  }
  return out;
}

function sha256OfFile(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

async function importOne(
  filePath: string,
  stats: ImportStats,
  seenHashes: Set<string>
): Promise<void> {
  const fileName = path.basename(filePath);
  try {
    const buffer = fs.readFileSync(filePath);

    const isMP3 =
      (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
      (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    if (!isMP3) {
      console.warn(`  SKIP (not a valid MP3): ${fileName}`);
      stats.failed += 1;
      return;
    }

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    if (seenHashes.has(fileHash)) {
      console.log(`  SKIP (already in DB): ${fileName}`);
      stats.skipped += 1;
      return;
    }

    let title: string | null = null;
    let artist: string | null = null;
    let album: string | null = null;
    let genre: string | null = null;
    let duration = 0;

    try {
      // @ts-expect-error - optional dep, may not be installed
      const mm = await import('music-metadata');
      const metadata = await mm.parseBuffer(buffer, { mimeType: 'audio/mpeg' });
      title = metadata.common.title || null;
      artist = metadata.common.artist || null;
      album = metadata.common.album || null;
      genre = metadata.common.genre?.[0] || null;
      if (metadata.format.duration) {
        duration = Math.round(metadata.format.duration);
      }
    } catch {
      // fall through to filename-based fallbacks
    }

    if (!title) {
      title = path.basename(fileName, path.extname(fileName));
    }
    if (!artist) artist = 'Unknown Artist';
    if (!genre) genre = 'Other';

    const newName = `${crypto.randomUUID()}.mp3`;
    const destPath = path.join(musicDir, newName);

    if (dryRun) {
      console.log(
        `  WOULD IMPORT: "${title}" by "${artist}" [${duration}s] from ${fileName}`
      );
      stats.imported += 1;
      seenHashes.add(fileHash);
      return;
    }

    if (copyMode) {
      fs.copyFileSync(filePath, destPath);
    } else {
      try {
        fs.renameSync(filePath, destPath);
      } catch {
        fs.copyFileSync(filePath, destPath);
        fs.unlinkSync(filePath);
      }
    }

    await prisma.song.create({
      data: {
        title,
        artist,
        album,
        genre,
        duration,
        fileUrl: `/uploads/music/${newName}`,
        fileSize: buffer.length,
        format: 'MP3',
        metadata: { sourceFile: fileName, sha256: fileHash } as Prisma.JsonObject,
      },
    });

    console.log(`  OK: "${title}" by "${artist}"`);
    stats.imported += 1;
    seenHashes.add(fileHash);
  } catch (err: any) {
    console.error(`  FAIL: ${fileName} - ${err.message}`);
    stats.failed += 1;
  }
}

async function main() {
  console.log(`\nScanning: ${sourceFolder}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : copyMode ? 'COPY' : 'MOVE'}`);
  console.log(`Destination: ${musicDir}\n`);

  const files = findMp3sRecursive(sourceFolder);
  console.log(`Found ${files.length} .mp3 files\n`);

  const existing = await prisma.song.findMany({
    where: { metadata: { path: ['sha256'], not: Prisma.AnyNull } },
    select: { metadata: true },
  });
  const seenHashes = new Set<string>();
  for (const s of existing) {
    const meta = s.metadata as { sha256?: string } | null;
    if (meta?.sha256) seenHashes.add(meta.sha256);
  }
  console.log(`Already in DB: ${seenHashes.size} songs (will be skipped if matched)\n`);

  const stats: ImportStats = { scanned: files.length, imported: 0, skipped: 0, failed: 0 };

  for (const file of files) {
    await importOne(file, stats, seenHashes);
  }

  console.log('\n=== Import complete ===');
  console.log(`Scanned:  ${stats.scanned}`);
  console.log(`Imported: ${stats.imported}`);
  console.log(`Skipped:  ${stats.skipped}`);
  console.log(`Failed:   ${stats.failed}`);
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
