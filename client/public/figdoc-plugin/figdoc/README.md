# Figdoc Figma plugin

Export selected layers without a personal access token. No build or dependencies are needed. This is a local development plugin, not a published Community plugin.

## Register once in Figma Desktop

1. Open a design file in Figma Desktop. Choose Plugins → Development → New plugin.
2. Create a Figma Design plugin with a custom UI and save its generated files to a new folder.
3. Copy this package's `code.js` and `ui.html` into that folder, replacing the starter files.
4. Open the generated `manifest.json`. Keep the `id` assigned by Figma, and replace its other fields with the fields in this package's `manifest.json`. Do not invent an ID.
5. Run the plugin from Plugins → Development. If necessary, use Import plugin from manifest to select the edited manifest.

## Use

1. Select frames or layers and run Figdoc.
2. Choose Prepare export, then Download .figdoc.json.
3. Open your Figdoc website. Under Import a design choose Plugin file, select the downloaded file, and choose Create document.
4. Review/edit the document and use its export menu for Word (.docx), PDF, Markdown, or JSON.

Only selected layers and their descendants are included; hidden layers are included. Overlapping parent/child selections are deduplicated. The plugin never modifies the design or makes network requests. Import uploads the file to your Figdoc server and uses the existing document saving workflow. Files above 9 MB must be split into smaller selections. This extracts structured content and styles, not a pixel-perfect rendering or image/OCR transcription.

Figma API reference: https://developers.figma.com/docs/plugins/api/properties/nodes-exportasync/
Manifest reference: https://developers.figma.com/docs/plugins/manifest/
