import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const hashPassword = (plain) => bcrypt.hash(String(plain), 10);
export const checkPassword = (plain, hash) => bcrypt.compare(String(plain || ''), hash);

// Temporary password for accounts an admin creates. It is returned once so the admin can pass it on.
export function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[crypto.randomInt(chars.length)];
  return `${out}!7`;
}

export const randomDigits = () => crypto.randomInt(1000, 9999);
