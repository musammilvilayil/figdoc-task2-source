# Figdoc

Figdoc converts a Figma file (or one selected frame) into an editable content document. It extracts copy, page/section context, typography, colors, and component usage, then exports the result as Markdown or JSON.

## What the MVP includes

- Two-page workflow: secure import → content-document workspace
- Figma design/file/prototype URL parsing, including `node-id`
- Live Figma REST API integration through the Express backend
- Text-layer classification (heading, body, button, label, and message)
- Copy grouped by Figma page and section
- Color and typography token inventory
- Component and instance inventory
- Editable copy with session saving
- Markdown and JSON exports
- Responsive UI, validation, API timeout, security headers, and rate limiting
- Demo file, so the full workflow can be tested without a Figma token
- Unit tests for URL parsing, document extraction, and Markdown export

## Architecture

```text
React/Vite UI
    │  POST /api/analyze (Figma URL + temporary token)
    ▼
Node/Express API ──────► Figma REST API
    │
    ├── parser: copy, tokens, components, insights
    └── exporter: Markdown / JSON
```

The personal access token is held only in the request memory. The application does not save it to browser storage or a database.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:5000

Open the frontend and select **Explore with a sample file** for a token-free demo.

## Connect a real Figma file

1. In Figma, create a personal access token with file-content read access.
2. Ensure the token's account can view the target file.
3. Paste a Figma design URL and the token into Figdoc.
4. A URL containing `node-id` imports only that selected frame/node; otherwise, the file is imported up to the API depth used by the MVP.

An optional server token can be configured for a controlled internal deployment:

```bash
cp .env.example .env
# Add FIGMA_ACCESS_TOKEN to .env
```

For a public production deployment, use OAuth instead of one shared personal access token.

## Commands

```bash
npm run dev      # frontend and backend in watch mode
npm run check    # lint, tests, and production build
npm run build    # create client/dist
npm start        # serve API and built React app
```

## API

### `POST /api/analyze`

```json
{
  "figmaUrl": "https://www.figma.com/design/FILE_KEY/Project?node-id=1-2",
  "token": "figd_..."
}
```

### `GET /api/demo`

Returns a complete sample content document.

### `POST /api/export/markdown`

Accepts `{ "document": contentDocument }` and returns a Markdown download.

### `POST /api/export/docx` and `POST /api/export/pdf`

Accept `{ "document": contentDocument }` and return a downloadable Word document or PDF. Both include the current edited copy, design tokens, components, and review notes. Use **Export → Word (.docx)** or **Export → PDF (.pdf)** in the document editor. Exports include the full document regardless of the active search or page filter. Fonts for PDF generation are bundled with the server dependency; no desktop Office installation is required.

## Current MVP limitations

- It extracts structured content and design metadata; it does not recreate a pixel-perfect webpage.
- Deeply nested files beyond the requested API depth may need a selected-frame URL.
- Images, vector descriptions, prototype flows, localization, and comments are not yet included.
- Editing content in Figdoc does not write changes back to Figma.
- Session edits are browser-session only; multi-user persistence needs authentication and a database.

## Suggested next phase

Add Figma OAuth, projects with MongoDB, team review/comments, document version comparison, localization/CSV export, and an optional Figma plugin for two-way sync.

