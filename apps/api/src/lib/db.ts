import { prisma } from './prisma.js';

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{
  database: boolean;
}> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { database: true };
  } catch {
    return { database: false };
  }
}
