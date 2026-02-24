# Ollama Provider Notes

- Default endpoint: `http://localhost:11434`; override per-project in Settings → AI Settings.
- Desktop app streams via the Electron provider registry (no API key needed). Renderer falls back to direct fetch only when Electron isn’t available.
- Requests use `/api/chat` with `{model, stream, messages}` payloads; chunk parsing handles one JSON object per line.
- Reminder: ensure Ollama daemon is running locally before selecting the provider, otherwise calls will error.
