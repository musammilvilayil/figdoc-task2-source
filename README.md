# Figdoc

## Figma plugin

The plugin uses managed Firebase Google sign-in and local Word/PDF/JSON exports. It does not need the Express server described below. See [plugin setup and deployment](figma-plugin/README.md). Browser sign-in returns an encrypted connection code to paste into Figma Desktop; no database relay is required.

Figdoc converts a Figma file (or one selected frame) into an editable content document. It extracts copy, page/section context, typography, colors, and component usage, then exports the result as Markdown or JSON.

## What the MVP includes

- Two-page workflow: secure import → content-document workspace
- Figma design/file/prototype URL parsing, including `node-id`
- Live Figma REST API integration through the Express backend
- Text-layer classification (heading, body, button, label, and message)
- Copy grouped by Figma page and section
- Color and typography token inventory
- Component and instance inventory
- Editable copy with server-backed document history and local fallback
- Markdown and JSON exports
- Responsive UI, validation, large-file page fetching, security headers, and rate limiting
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

The personal access token is held only in request memory. Imported documents are stored in the server's local `figdoc-library.json`; the token is never persisted. Accounts use hashed passwords and bearer sessions stored in the configured data directory.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:5000

Open the frontend and import a Figma file using a personal access token.

Create an account in the app before importing. To enable email notifications, configure the SMTP variables in `.env`. `NOTIFICATION_LIMIT=0` currently leaves the extra action-notification cap disabled; set it above `0` later to cap login, registration, document preparation, and download actions per hour.

Google sign-in is optional. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `.env`, and register the callback URL with Google. The app asks on every open; users can choose Google or continue as a guest.

## Connect a real Figma file

1. In Figma, create a personal access token with file-content read access.
2. Ensure the token's account can view the target file.
3. Paste a Figma design URL and the token into Figdoc.
4. A URL containing `node-id` imports only that selected frame/node; otherwise, the API fetches each page subtree separately to preserve deeply nested content.

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

### `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/guest`, `GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/logout`, and `GET /api/auth/me`

Authentication uses an email and password. Login returns a bearer token; send it as `Authorization: Bearer <token>` on protected API calls.

### `GET /api/documents` and `PUT /api/documents/:localId`

List and persist imported content documents. The server stores these records in `figdoc-library.json` (or `FIGDOC_DATA_DIR` when configured).

### `POST /api/export/markdown`

Accepts `{ "document": contentDocument }` and returns a Markdown download.

### `POST /api/export/docx` and `POST /api/export/pdf`

Accept `{ "document": contentDocument }` and return a downloadable Word document or PDF. Both include the current edited copy, design tokens, components, and review notes. Use **Export → Word (.docx)** or **Export → PDF (.pdf)** in the document editor. Exports can target the whole document, current filters, a page, or a section. Fonts for PDF generation are bundled with the server dependency; no desktop Office installation is required.

### `POST /api/notifications/email`

Accepts `{ "recipient": "person@example.com", "documentName": "Document" }`. Delivery requires SMTP configuration. This email route is separate from the action-notification limit.

## Current MVP limitations

- It extracts structured content and design metadata; it does not recreate a pixel-perfect webpage.
- Server-side document history is local to the configured server instance and does not yet have accounts or permissions.
- Images, vector descriptions, prototype flows, localization, and comments are not yet included.
- Editing content in Figdoc does not write changes back to Figma.
- The extra action-notification limit is disabled while `NOTIFICATION_LIMIT=0`.

## Suggested next phase

Add Figma OAuth, projects with MongoDB, team review/comments, document version comparison, localization/CSV export, and an optional Figma plugin for two-way sync.

