# Figdoc website documentation

Build 2026.09.25.3. No login or registration.

1. In Figma Desktop, import manifest.json using Plugins > Development > Import plugin from manifest.
2. Select the complete frames you want to document. Nested layers are included; other pages are not.
3. Open Figdoc and click Prepare document.
4. Download Word/PDF and the matching images ZIP. Technical JSON retains the full layer inventory.

The document includes scope, layouts, exact copy, typography, individual pictures, responsive/behavior requirements and open items. It is one website document without separate developer/manager sections. Unknown requirements need decisions; the plugin does not infer a complete website from a cover frame. Status is draft, never automatically approved.

Images ZIP contains rendered PNG previews with filenames matching the document. Transparent assets appear against a dark background in the document; PNG files retain transparency. Preview exports can be downscaled, so confirm production resolution and rights. Image limits are 40 pictures and 5 MB total; export smaller selections if needed. Overall payload limit is 16 MB.

All processing is local. The plugin manifest permits no external network domains. Legacy authentication source in the repository is unused.

Development: npm ci, then npm run check. Main documentation source is server/src/component-report.js; UI is figma-plugin/ui-entry.js. Actual Figma testing is still required after importing a new build.
