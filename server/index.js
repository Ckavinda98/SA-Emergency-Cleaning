import { createApp } from './app.js';
import { env, assertProductionSecrets } from './config/env.js';
import { startHousekeeping } from './lib/housekeeping.js';

assertProductionSecrets();

createApp().listen(env.PORT, () => {
  startHousekeeping();
  console.log(`=======================================================`);
  console.log(`SACC Emergency Membership Backend API Server Running`);
  console.log(`Port: http://localhost:${env.PORT}`);
  console.log(`Health Check: http://localhost:${env.PORT}/api/health`);
  console.log(`=======================================================`);
});
