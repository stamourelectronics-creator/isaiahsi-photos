# Isaiahsi Photos

A static photo library that stores uploads in a private `Isaiahsi Photos` folder in Google Drive. Puter AI is used when you request a library search, chat about your photos, request an edit, or generate an image.

## Google Drive setup

1. Create a Google Cloud project and enable the Google Drive API.
2. Configure the OAuth consent screen and add your Google account as a test user while the app is in testing.
3. Create an OAuth 2.0 Client ID for a Web application. Add the exact app origin (for example `http://localhost:8000`) under Authorized JavaScript origins.
4. Set `googleClientId` in `config.js` to that client ID.
5. Serve the directory, for example with `python3 -m http.server 8000`, then open `http://localhost:8000`.

The app requests the Google Drive `drive` scope so it can search photo and video metadata across Drive and rename or move selected items. Chat history is saved as a JSON file in the private app folder. The chatbot can answer general questions, search media by file name/type/date, rename or move an identified file, and organize media into date folders. It always previews file changes and requires confirmation before applying them; it does not delete files. Searches and file operations use Drive metadata in the browser. AI requests are sent to Puter, and photo-content analysis is limited to images loaded in the app's private folder.

## Windows app and ICode

Isaiahsi ICode generates standalone HTML using Puter AI and Claude Sonnet 4. Prompts are sent to Puter. Generated code is displayed for review and previewed in a sandbox that blocks network requests and access to local files. The preview is not executed with desktop privileges. In the Windows app, choose a project folder before saving; saves are limited to that folder, and replacing an existing file requires confirmation. Notepad can only be opened using its explicit button. The app does not provide arbitrary shell or computer-control access.

To run or package on Windows, install Node.js 22 or later, then run `npm install`, `npm start`, or `npm run build:windows`. The installer is written to `release/Isaiahsi-Photos-Setup.exe`. Every push to `main` builds the Windows installer and publishes a numbered GitHub Release marked as latest. The download controls point to that release's installer asset. Pushing a `v*` tag publishes that tagged version; running the workflow manually uploads the installer as a build artifact.

The desktop app serves its bundled pages from `http://localhost:8000` for Google sign-in. Add that exact origin to the OAuth client's authorized JavaScript origins. AI generation needs an internet connection and is subject to Puter's model availability and usage policies.

## Notes

This uses Google Identity Services and the Drive API directly; Firebase Storage does not store files in Google Drive. The broad Drive scope may require additional OAuth consent-screen configuration or verification. The photo edit currently applies an AI-selected visual filter and replaces the file in Drive; it is not generative inpainting. Pinch and keyboard zoom are disabled in the app as requested, though browser accessibility overrides may still permit zoom.