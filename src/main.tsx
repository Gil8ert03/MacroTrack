import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AppProvider } from './state';
import { requestPersistence } from './db';
import './lib/install';
import './styles.css';

registerSW({ immediate: true });
// Pide almacenamiento persistente (Chrome lo concede automáticamente a apps instaladas o muy usadas).
requestPersistence();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
