# Figdoc — no login required

1. In Figma Desktop, open Plugins > Development > Import plugin from manifest.
2. Select manifest.json from this folder and open Figdoc.
3. Select frames or layers, click Prepare document, then download Word, PDF or JSON.

Figdoc opens the document page directly. No login, registration, Google account, guest selection, localhost or separate server is required. The plugin does not connect to Firebase. Documents are generated locally from selected layers.

Build 2026.09.24.3 · No login. Keep manifest.json, code.js and ui.html together. Selection changes invalidate prepared exports. Selections above 9 MB must be split.

Development: npm ci, then npm run check. Legacy hosted authentication source remains in the repository but is not included in the plugin.
