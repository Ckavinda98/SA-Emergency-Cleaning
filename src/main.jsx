import React from 'react';
import ReactDOM from 'react-dom/client';
import { installAuthFetch } from '@/shared/api/client.js';
import App from '@/app/App.jsx';
import './index.css';

// Attach the token to every API call (and refresh it on 401) before the first render.
installAuthFetch();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
