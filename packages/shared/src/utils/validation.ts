/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Brazilian phone number
 */
export function isValidBrazilianPhone(phone: string): boolean {
  // Accepts: +55 XX XXXXX-XXXX or similar variations
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 11 || cleaned.length === 13; // 11 without country, 13 with +55
}

/**
 * Validate that amount is positive
 */
export function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && amount > 0 && isFinite(amount);
}

/**
 * Sanitize string input (trim and limit length)
 */
export function sanitizeString(input: string, maxLength = 255): string {
  return input.trim().slice(0, maxLength);
}

/**
 * Generate a random OTP code
 */
export function generateOTP(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}
