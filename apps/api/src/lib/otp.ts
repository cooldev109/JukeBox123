import { redis } from './redis.js';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const OTP_PREFIX = 'otp:';

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

/**
 * Store OTP in Redis with expiry
 */
export async function storeOTP(phone: string, otp: string): Promise<void> {
  await redis.setex(`${OTP_PREFIX}${phone}`, OTP_EXPIRY_SECONDS, otp);
}

/**
 * Verify OTP from Redis
 */
export async function verifyOTP(phone: string, otp: string): Promise<boolean> {
  const stored = await redis.get(`${OTP_PREFIX}${phone}`);
  if (!stored) return false;
  if (stored !== otp) return false;

  // Delete after successful verification
  await redis.del(`${OTP_PREFIX}${phone}`);
  return true;
}
