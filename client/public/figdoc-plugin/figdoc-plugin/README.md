# Figdoc website documentation

Build 2026.09.28.3. No login or registration.

1. In Figma Desktop, import manifest.json using Plugins > Development > Import plugin from manifest.
2. Open the Figma page you want to document. No selection is needed.
3. Open Figdoc, leave Document scope set to Current page (all screens), and click Prepare document.
4. Download Word/PDF and the matching images ZIP. Technical JSON retains the full captured layer inventory.

Current page includes all visible top-level designs, including screens inside nested Figma Sections. It does not include other Figma pages. For a smaller export, choose Selected frames; child selections expand to their containing screen and duplicates are merged in document order. The plugin shows the scope before export.

The document follows the reference content-document format: page metadata, followed by each screen and its sections. Single wrapper frames are unwrapped for section grouping. Images, exact copy, links, typography, section layout details and captured interactions stay together. Current-page reports use compact text specifications and section layout tables instead of a table for every decorative layer. Full per-layer properties remain in technical JSON. Missing website metadata and link information use "To add" fields. No audience-specific reports or approval checklists are added.

Images ZIP contains rendered PNG image layers with filenames matching the document. Transparent assets use the captured Figma background in the document; PNG files retain transparency. Exports can be downscaled, so confirm production resolution and rights. Limits are 300 combined image/section previews and 24 MB of PNG data; overall JSON payload limit is 64 MB. Choose Selected frames for exports exceeding these limits. Missing required image exports cause an error rather than silently dropping pictures.

All processing is local. The plugin manifest permits no external network domains. Legacy authentication source in the repository is unused.

Development: npm ci, then npm run check. Main documentation source is server/src/component-report.js; UI is figma-plugin/ui-entry.js. Close and reopen a running development plugin after updating its files.
