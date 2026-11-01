import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { db } from './data/db';
import { ensureSeeded } from './data/seed';
import { SimProvider } from './features/drive/SimContext';
import { Toaster } from './ui/toast';

ensureSeeded(db).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <SimProvider>
          <App />
          <Toaster />
        </SimProvider>
      </AuthProvider>
    </StrictMode>,
  );
});
