import { prisma } from './prisma.js';

// Web Push configuration
// In production, generate VAPID keys with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'admin@solodevs.net';

let webPush: any = null;

async function getWebPush() {
  if (webPush) return webPush;
  try {
    // @ts-expect-error - web-push is an optional dependency
    webPush = await import('web-push');
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      webPush.setVapidDetails(
        `mailto:${VAPID_EMAIL}`,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY,
      );
    }
    return webPush;
  } catch {
    console.warn('web-push not installed. Push notifications disabled.');
    return null;
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

/**
 * Send a push notification to a specific subscription
 */
export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const wp = await getWebPush();
  if (!wp || !VAPID_PUBLIC_KEY) return false;

  try {
    await wp.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (error: any) {
    // If subscription is expired/invalid, remove it
    if (error.statusCode === 404 || error.statusCode === 410) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: subscription.endpoint },
      });
    }
    console.error('Push notification failed:', error.message);
    return false;
  }
}

/**
 * Send push notification to all subscriptions for a user
 */
export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<number> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  let sent = 0;
  for (const sub of subscriptions) {
    const success = await sendPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      { title, body, data },
    );
    if (success) sent++;
  }
  return sent;
}

/**
 * Send push notification to all users with a given role
 */
export async function notifyRole(
  role: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<number> {
  const users = await prisma.user.findMany({
    where: { role: role as any },
    select: { id: true },
  });

  let sent = 0;
  for (const user of users) {
    sent += await notifyUser(user.id, title, body, data);
  }
  return sent;
}
