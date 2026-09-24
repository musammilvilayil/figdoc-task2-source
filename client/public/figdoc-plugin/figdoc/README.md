# Figdoc — quick setup

## Install once in Figma Desktop

1. Open Plugins > Development > Import plugin from manifest.
2. Select manifest.json in this Figdoc folder.
3. Open Figdoc from Plugins > Development.

The folder is ready to import. No commands, file editing or separate server are needed. Its plugin ID comes from the existing registration in this repository.

## Use

1. Choose Continue with Google or Continue as guest. Guest opens the document page immediately. Google opens your browser to choose an account.
2. Wait for Connected, then return to Figma. No code copying or pasting.
3. Select frames, click Prepare document and download Word or PDF.

Keep the sign-in browser page open until it says Connected. If you close it early, click Cancel sign-in in the plugin and try again. Closing the plugin signs out; 1. Access > Sign out also clears prepared exports.

## Managed services and privacy

Firebase Authentication handles Google accounts. Firebase Hosting serves the sign-in page. Firebase Realtime Database temporarily relays an encrypted sign-in response to the initiating plugin. No design text, images or documents are stored there.

The relay is encrypted using Web Crypto ECDH P-256 and AES-GCM, bound to a random 256-bit request identifier, and expires after ten minutes. Database rules deny listing, anonymous writes, overwrites, expired writes and unknown fields. Only the Google-authenticated owner can create or delete a record. The encrypted record is readable only through its unguessable request path while valid. The plugin deletes it after login; the browser also schedules deletion on disconnect and timeout. Firebase controls disconnect detection timing.

Plugin tokens stay in memory. The hosted browser temporarily uses session storage through Google redirect and clears authentication after completion. Google sessions require internet access for sign-in and preparation. Guest sessions export without Google or Firebase. The sessionMode variable tracks signed-out, google or guest access. The controller verifies Google sessions before exporting; exports render locally. As with all open-source plugins, someone modifying the source can remove a local login gate.

## Development

Run npm ci, then npm run check. This builds the plugin and hosted page and runs the tests. Source files are figma-plugin/figdoc/code.ts, figma-plugin/auth-ui.js, figma-plugin/relay.js, figma-plugin/ui-entry.js, figma-plugin/ui-template.html and auth-site/.

Public Firebase configuration is in figma-plugin/firebase-config.js; never add OAuth client secrets or service-account keys. Rules are in database.rules.json. To deploy, run npm run build:auth then npx firebase-tools deploy --only database,hosting --project figdoc-e0f98. Database and hosting use the project's Spark plan quotas; no billing upgrade was made.

Selections above 9 MB must be split. Selection changes, failed imports and sign-out invalidate prepared exports. Existing PDF font coverage is unchanged.
