/**
 * Move every active song whose flat genre is NOT one of the admin-curated
 * (active) Genre-table names into "Other", so the customer genre list matches
 * the admin one. Junk ID3 genres (Arrocha, Alternative Metal, …) get bucketed
 * into "Other" for the admin to re-file.
 *
 * Dry-run:  node --env-file=.env scripts/cleanup-genres.mjs
 * Apply:    node --env-file=.env scripts/cleanup-genres.mjs --apply
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const curated = await prisma.genre.findMany({ where: { isActive: true }, select: { name: true } });
const curatedSet = new Set(curated.map((g) => g.name.toLowerCase()));
curatedSet.add('other'); // Other is the bucket — never move Other songs

const songGenres = await prisma.song.groupBy({
  by: ['genre'],
  where: { isActive: true },
  _count: { _all: true },
});

const toMove = songGenres.filter((g) => !curatedSet.has(g.genre.toLowerCase()));
console.log('Curated genres:', [...curatedSet].filter((g) => g !== 'other').join(', '));
console.log('\nGenres that will be moved to "Other":');
let total = 0;
for (const g of toMove) {
  console.log(`  ${g.genre.padEnd(24)} ${g._count._all} song(s)`);
  total += g._count._all;
}
console.log(`\n${apply ? 'APPLYING' : 'DRY-RUN'}: ${total} song(s) across ${toMove.length} genre(s) → Other`);

if (apply && toMove.length > 0) {
  // Ensure an "Other" genre exists and is active
  const other = await prisma.genre.findUnique({ where: { name: 'Other' } });
  if (!other) await prisma.genre.create({ data: { name: 'Other' } });
  else if (!other.isActive) await prisma.genre.update({ where: { id: other.id }, data: { isActive: true } });

  for (const g of toMove) {
    await prisma.song.updateMany({
      where: { genre: g.genre, isActive: true },
      data: { genre: 'Other' },
    });
  }
  console.log('Done.');
}

await prisma.$disconnect();
