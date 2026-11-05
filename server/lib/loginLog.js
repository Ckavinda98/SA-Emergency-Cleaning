import { prisma } from '../db/prisma.js';

// LOGIN HISTORY (LoginLog table). Logging must never break the request itself.
export async function recordLogin(actor, { userId = null, email, role = null, event, reason = null }) {
  try {
    await prisma.loginLog.create({
      data: {
        userId,
        email: (email || '').toLowerCase(),
        success: event === 'LOGIN_SUCCESS',
        role,
        event,
        reason,
        ipAddress: actor?.ip || null,
        userAgent: actor?.userAgent || null
      }
    });
  } catch (error) {
    console.warn('LoginLog write failed:', error.message);
  }
}
