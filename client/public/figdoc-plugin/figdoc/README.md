# Figdoc — Google sign-in and document handoff

Select Figma layers and export editable Word, PDF or plugin JSON. Google sign-in is required. The plugin uses Firebase Authentication and a static Firebase Hosting page; it needs no localhost, Express server, Firestore, Realtime Database, Cloud Functions or separately managed backend.

## Use in Figma Desktop or browser

Register a development plugin in Figma and copy code.js and ui.html into its folder. Merge this manifest with the generated manifest while keeping Figma's assigned plugin id. The source manifest has no assigned plugin ID.

1. Click Continue with Google in the plugin. This opens https://figdoc-e0f98.firebaseapp.com/ with a request specific to this plugin session.
2. Sign in with Google on that page and click Copy connection code.
3. Return to the plugin, paste the code and click Connect.
4. Select frames, click Prepare document, then download Word, PDF or JSON.

The manual copy/paste step supports Figma Desktop, whose external browser cannot send a popup message back to the plugin. It avoids a server or database relay. Codes expire after ten minutes, work only with the originating plugin instance, and are consumed once. Closing the plugin signs out. Use 1. Access > Sign out to clear the session and prepared exports manually.

Sign-in and preparation require internet access to verify the Google session. Export rendering and design content remain local. No design content is uploaded to Firebase. Firebase Authentication stores the user's account information as part of its managed authentication service.

## Development and deployment

Run npm ci, npm run package:plugin, and npm run check from the repository root. Edit figma-plugin/figdoc/code.ts for the controller, ui-entry.js / auth-ui.js for UI behavior, ui-template.html for appearance, and server/src/report.js for report layout. Generated bundles are overwritten on build.

The public Firebase configuration is in figma-plugin/firebase-config.js. Google must be enabled in Firebase Authentication, with the project's web.app and firebaseapp.com domains authorized. Never add service-account keys or OAuth client secrets to this repository.

The hosted sign-in source is in auth-site/. Run npm run build:auth, then authenticate the official Firebase CLI using npx firebase-tools login --no-localhost. Run npm run deploy:auth to publish only the static hosting site for project figdoc-e0f98. No database or function deployment is configured. Build success does not imply the site is deployed or that live Google sign-in was tested.

The handoff uses Web Crypto ECDH P-256 and AES-GCM. The URL fragment contains only the request nonce, expiry and public key; it is removed from browser history on load. The Google credential is encrypted for the initiating plugin, then exchanged through Firebase's SDK. Plugin tokens stay in memory. The hosted page uses browser-session persistence during the Google redirect, then signs out once the connection code has been generated. The controller verifies the Firebase ID token with Google before allowing exports, including after refresh. Authentication is a gate for the distributed plugin, not DRM against someone modifying this open-source code.

Selection changes, failed imports and sign-out invalidate previous prepared exports. Selections above 9 MB must be split. Exports describe actual design text and metadata; they do not recreate screenshots or transcribe image text. PDF font coverage remains the shared report engine's coverage.
