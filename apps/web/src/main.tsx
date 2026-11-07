import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// OpenDyslexic ships with the app (SIL Open Font License, see
// public/fonts/OpenDyslexic-LICENSE.txt) so the Dyslexic text style works
// without a font install.
import '@fontsource/opendyslexic/latin-400.css';
import '@fontsource/opendyslexic/latin-400-italic.css';
import '@fontsource/opendyslexic/latin-700.css';
import '@fontsource/opendyslexic/latin-700-italic.css';
import './styles/theme.css';
import './index.css';
import App from './App.tsx';
import {installGlobalDiagnosticCapture} from './services/errors';
import {startVaultContextLifecycle} from './services/contextHealth/vaultContextLifecycle';

installGlobalDiagnosticCapture();
startVaultContextLifecycle();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
