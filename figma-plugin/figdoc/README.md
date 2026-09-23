# Figdoc plugin — full document exports

The plugin uses the same parser, report tables, Word layout and PDF definition as the Figdoc web application. Exports include actual text grouped by page/section, colors, typography, components, overview tables, copy reference, review notes and the handoff checklist. Export scope is the selected Figma layers (including hidden descendants). Edits made only in the website are not reflected in the Figma file or plugin export.

## Run in Figma Desktop

Use Plugins > Development to run your registered plugin. If it is not registered, create a new Figma Design plugin with custom UI. Copy code.js and ui.html into the generated folder, and merge this manifest's fields while retaining Figma's generated id. This source manifest does not include an assigned plugin id.

Select frames, click Prepare document, then Download Word or Download PDF. Download plugin JSON allows further editing in the Figdoc website. No personal access token or network calls are needed by the plugin. All libraries and Roboto PDF fonts are bundled locally. PDF language/font coverage is the same as the website; this does not add support for new writing systems.

## Development

From the repository root run `npm install` then `npm run package:plugin`. Or run `npm run build` in figma-plugin/figdoc after installing root dependencies. The shared build updates both plugin directories and packaging creates client/public/figdoc-plugin.zip.

Edit figma-plugin/figdoc/code.ts for the Figma controller, figma-plugin/ui-entry.js for UI behavior, figma-plugin/ui-template.html for appearance, and server/src/report.js for the shared report layout. Generated code.js and ui.html are overwritten on build. The TypeScript starter rectangle code has been replaced.

Files over 9 MB must be split into smaller selections. These documents describe the design; they do not recreate its screenshot or transcribe image text. Selection changes and failed imports invalidate earlier export data.
