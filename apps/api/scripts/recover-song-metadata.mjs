/**
 * One-off recovery: re-parse ID3 tags from on-disk MP3 files for songs that
 * were bulk-uploaded before `music-metadata` was installed and therefore saved
 * as "Untitled / Unknown Artist / Other / duration 0".
 *
 * Dry-run:  node --env-file=.env scripts/recover-song-metadata.mjs
 * Apply:    node --env-file=.env scripts/recover-song-metadata.mjs --apply
 */
import { PrismaClient } from '@prisma/client';
import { parseBuffer } from 'music-metadata';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const songs = await prisma.song.findMany({ where: { title: 'Untitled' } });
console.log(`Found ${songs.length} songs titled "Untitled"\n`);

let fixed = 0;
let skipped = 0;

for (const s of songs) {
  const filePath = path.join(process.cwd(), s.fileUrl.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (file missing): ${s.fileUrl}`);
    skipped++;
    continue;
  }

  let md;
  try {
    const buf = fs.readFileSync(filePath);
    md = await parseBuffer(buf, { mimeType: 'audio/mpeg' }, { duration: true });
  } catch (e) {
    console.log(`SKIP (parse failed): ${s.fileUrl} — ${e.message}`);
    skipped++;
    continue;
  }

  const title = md.common.title?.trim();
  const artist = md.common.artist?.trim();
  const album = md.common.album?.trim() || null;
  const genre = md.common.genre?.[0]?.trim();
  const duration = Math.round(md.format.duration || 0);

  if (!title && !artist) {
    console.log(`SKIP (no tags): ${s.fileUrl}`);
    skipped++;
    continue;
  }

  const data = {
    title: title || s.title,
    artist: artist || 'Unknown Artist',
    album,
    duration: duration > 0 ? duration : s.duration,
  };
  if (genre) data.genre = genre;

  console.log(
    `${apply ? 'FIX ' : 'DRY '} ${data.title} / ${data.artist}` +
      ` · ${data.duration}s${genre ? ` · ${genre}` : ''}`,
  );

  if (apply) {
    await prisma.song.update({ where: { id: s.id }, data });
  }
  fixed++;
}

console.log(
  `\n${apply ? 'APPLIED' : 'DRY-RUN'}: ${fixed} recovered, ${skipped} skipped (no tags / missing file)`,
);
await prisma.$disconnect();
