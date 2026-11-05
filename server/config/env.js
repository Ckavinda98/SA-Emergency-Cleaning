// All settings read from the environment in one place.
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'sacc_super_secret_key_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'sacc_super_refresh_secret_2026',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '7d',
  JSON_LIMIT: '50mb'
};

export const isProduction = env.NODE_ENV === 'production';

// Never run production with the development secrets
export function assertProductionSecrets() {
  if (isProduction && (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET)) {
    console.error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production.');
    process.exit(1);
  }
}
