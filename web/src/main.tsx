import '@fontsource-variable/archivo/wdth.css';
import './ui/tokens.css';
import './ui/ui.css';
import './app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
