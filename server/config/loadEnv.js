// Loads the .env file on your PC. On Render / Azure the settings come from the dashboard instead,
// and values already set there always win over the file.
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
