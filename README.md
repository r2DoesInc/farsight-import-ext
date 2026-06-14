# Farsight Importer — Chrome Extension

A standalone Chrome Extension (Manifest V3) for importing content into the Farsight GM app.

## Features

- **D&D Beyond**: Reads your existing Chrome session cookie — no in-app login required.
  Google Sign-In works because you're already signed in to Chrome.
- **Foundry VTT**: Connect directly to your Foundry instance over LAN, browse actor packs,
  and import monsters to the Farsight bestiary.

## Setup

1. Open Farsight on your tablet/device.
2. Go to **Settings → App → Farsight Importer Extension** and copy the server URL.
3. In the extension, open the **Settings** tab and paste the URL.
4. Click **Test connection** to verify.

## Loading in Chrome (development)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `tools/farsight-import-ext/` directory
4. Add PNG icons to `icons/` (see `icons/README.md` for the required sizes)

## Publishing

1. Add production PNG icons to `icons/`
2. Zip the `tools/farsight-import-ext/` directory (excluding `README.md` files if desired)
3. Upload to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

## File structure

```
manifest.json           MV3 extension manifest
icons/                  16, 32, 48, 128 px PNG icons
popup/
  popup.html            Tabbed UI: D&D Beyond | Foundry VTT | Settings
  popup.js              All popup logic
  popup.css             Dark themed UI matching Farsight brand
background/
  service_worker.js     Minimal background worker
```

## REST API (app-side)

The extension talks to the Farsight embedded server at `http://[device-ip]:8080`:

| Endpoint                      | Method | Description              |
| ----------------------------- | ------ | ------------------------ |
| `/api/import/status`          | GET    | Check connection         |
| `/api/import/parties`         | GET    | List parties             |
| `/api/import/ddb-token`       | POST   | Send cobalt-token        |
| `/api/import/ddb/characters`  | GET    | List DDB characters      |
| `/api/import/ddb/campaigns`   | GET    | List DDB campaigns       |
| `/api/import/ddb/import`      | POST   | Import characters        |
| `/api/import/foundry/connect` | POST   | Connect & discover packs |
| `/api/import/foundry/packs`   | GET    | Get discovered packs     |
| `/api/import/foundry/import`  | POST   | Import packs             |
| `/api/import/foundry/release` | POST   | Close Foundry socket     |
