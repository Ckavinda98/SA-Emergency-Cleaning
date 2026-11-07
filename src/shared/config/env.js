// Front-end settings. Set VITE_API_BASE in .env (or .env.local) to point the app at another API.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
export const IS_DEV = Boolean(import.meta.env && import.meta.env.DEV);
// Google Maps JavaScript API key with the Places API (New) enabled. Without it, address fields are plain text boxes.
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
