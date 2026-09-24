# Figdoc — no login required



1. In Figma Desktop, open Plugins > Development > Import plugin from manifest.

2. Select manifest.json from this folder and open Figdoc.

3. Select frames or layers, click Prepare document, then download Word, PDF or JSON.



Figdoc opens the document page directly. No login, registration, Google account, guest selection, localhost or separate server is required. The plugin does not connect to Firebase. Documents are generated locally from selected layers. Word and PDF follow the supplied component-content model: title and URL, SEO metadata table, component previews and field/value tables for heading text/level, descriptions, links/buttons and image details. Unknown website metadata is marked Not provided. Text stays editable in Word.



Build 2026.09.24.4 · Component document. Keep manifest.json, code.js and ui.html together. Selection changes invalidate prepared exports. Selections above 16 MB must be split. Component previews are limited to 40 images and 5 MB total; omitted previews are listed in Export notes.



Development: npm ci, then npm run check. Legacy hosted authentication source remains in the repository but is not included in the plugin.


Detailed export build 2026.09.25.1: every node under the selected roots appears in Complete layer inventory, including hidden and non-text layers. Includes IDs, hierarchy, visibility, dimensions, positions, fills, strokes, effects, layout, constraints, component properties, interactions and text runs when available. JSON includes the full tree and flat layer inventory. Some API properties may be unavailable or mixed; notes identify these. This is selected-scope extraction, not the entire file. Preview limits do not truncate the layer inventory.
