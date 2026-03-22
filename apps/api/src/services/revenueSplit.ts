import { prisma } from '../lib/prisma.js';

export interface SplitConfig {
  platformPercent: number;
  venuePercent: number;
  affiliatePercent: number;
  operatorPercent: number;
}

const DEFAULT_SPLIT: SplitConfig = {
  platformPercent: 30,
  venuePercent: 30,
  affiliatePercent: 35,
  operatorPercent: 5,
};

/**
 * Get the commission split config for a venue.
 * Priority: venue settings > global config > hardcoded default.
 */
export async function getVenueSplitConfig(venueId: string): Promise<SplitConfig> {
  // Check venue-level override
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { settings: true },
  });
  const venueSettings = (venue?.settings || {}) as Record<string, unknown>;
  const venueSplit = venueSettings.commissionSplit as SplitConfig | undefined;
  if (venueSplit && typeof venueSplit.platformPercent === 'number') {
    return venueSplit;
  }

  // Check global config
  const globalConfig = await prisma.globalConfig.findUnique({
    where: { key: 'defaultCommissionSplit' },
  });
  if (globalConfig?.value && typeof (globalConfig.value as any).platformPercent === 'number') {
    return globalConfig.value as unknown as SplitConfig;
  }

  return DEFAULT_SPLIT;
}

/**
 * Create a revenue split record for a completed transaction.
 * If no affiliate exists for the venue, affiliate share goes to platform.
 * If no operator exists, operator share goes to platform.
 */
export async function createSplit(transactionId: string, venueId: string): Promise<void> {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction || transaction.status !== 'COMPLETED') return;

  const config = await getVenueSplitConfig(venueId);
  const totalAmount = transaction.amount;

  // Find active affiliate for this venue
  const activeReferral = await prisma.affiliateReferral.findFirst({
    where: {
      venueId,
      isActive: true,
      endDate: { gte: new Date() },
    },
    select: { affiliateId: true },
  });

  // Find assigned operator (employee) — look for employee with regionAccess matching venue
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { city: true, state: true },
  });
  let operatorId: string | null = null;
  if (venue) {
    const operator = await prisma.user.findFirst({
      where: {
        role: 'EMPLOYEE',
        isActive: true,
        OR: [
          { regionAccess: { contains: venue.state } },
          { regionAccess: { contains: venue.city } },
        ],
      },
      select: { id: true },
    });
    operatorId = operator?.id ?? null;
  }

  // Calculate amounts
  let platformPercent = config.platformPercent;
  let venuePercent = config.venuePercent;
  let affiliatePercent = config.affiliatePercent;
  let operatorPercent = config.operatorPercent;

  // If no affiliate, their share goes to platform
  if (!activeReferral) {
    platformPercent += affiliatePercent;
    affiliatePercent = 0;
  }

  // If no operator, their share goes to platform
  if (!operatorId) {
    platformPercent += operatorPercent;
    operatorPercent = 0;
  }

  const platformAmount = Math.round((totalAmount * platformPercent / 100) * 100) / 100;
  const venueAmount = Math.round((totalAmount * venuePercent / 100) * 100) / 100;
  const affiliateAmount = Math.round((totalAmount * affiliatePercent / 100) * 100) / 100;
  const operatorAmount = Math.round((totalAmount * operatorPercent / 100) * 100) / 100;

  await prisma.revenueSplit.create({
    data: {
      transactionId,
      venueId,
      totalAmount,
      platformAmount,
      platformPercent,
      venueAmount,
      venuePercent,
      affiliateAmount,
      affiliatePercent,
      operatorAmount,
      operatorPercent,
      affiliateId: activeReferral?.affiliateId ?? null,
      operatorId,
    },
  });
}
