// All settings read from the environment in one place.
import './loadEnv.js';

const list = (v) => String(v || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'sacc_super_secret_key_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'sacc_super_refresh_secret_2026',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '7d',
  // Websites allowed to call the API from a browser (comma separated).
  // https://localhost and capacitor://localhost are the Android app (Capacitor).
  CORS_ORIGIN: list(process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000,https://localhost,capacitor://localhost'),
  // Where uploaded files go: inline (base64 inside the job row, needs no setup) | supabase (free hosting)
  STORAGE_DRIVER: (process.env.STORAGE_DRIVER || 'inline').toLowerCase(),
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'sacc-files',
  SUPABASE_PUBLIC_BUCKET: process.env.SUPABASE_PUBLIC_BUCKET !== 'false',
  MAX_IMAGE_MB: Number(process.env.MAX_IMAGE_MB) || 5,
  MAX_VIDEO_MB: Number(process.env.MAX_VIDEO_MB) || 25,
  // Large only while photos travel as base64 (STORAGE_DRIVER=inline). Set JSON_LIMIT=2mb on Render.
  JSON_LIMIT: process.env.JSON_LIMIT || '50mb',
  LOGIN_LIMIT_PER_15_MIN: Number(process.env.LOGIN_LIMIT_PER_15_MIN) || 10
};

export const isProduction = env.NODE_ENV === 'production';

// Never run production with the development secrets, or without a database / allowed website
export function assertProductionSecrets() {
  if (!isProduction) return;
  const missing = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'CORS_ORIGIN'].filter(k => !process.env[k]);
  if (env.STORAGE_DRIVER === 'supabase') {
    missing.push(...['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(k => !process.env[k]));
  }
  if (missing.length) {
    console.error(`Missing settings for production: ${missing.join(', ')}. Add them in the hosting dashboard.`);
    process.exit(1);
  }
}
