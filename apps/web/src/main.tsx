import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './index.css';
import App from './App.tsx';
import {installGlobalDiagnosticCapture} from './services/errors';

installGlobalDiagnosticCapture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
