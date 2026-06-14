# Farsight External Importer — Chrome Extension

**Available on itch.io:** https://futurehax.itch.io/farsight-external-importer

A standalone Chrome Extension (Manifest V3) for importing content into the Farsight GM app.

## Features

- **D&D Beyond**: Reads your existing Chrome session cookie — no in-app login required.
  Google Sign-In works because you're already signed in to Chrome.
- **Foundry VTT**: Connect directly to your Foundry instance over LAN, browse actor packs
  and roll-table packs, and import monsters, ships, and rules tables to the Farsight bestiary
  and Resources tab.

## Setup

1. Purchase and download the extension from [itch.io](https://futurehax.itch.io/farsight-external-importer).
2. Open Farsight on your tablet/device.
3. Go to **Settings → App → Farsight Importer Extension** and copy the server URL.
4. In the extension, open the **Settings** tab and paste the URL.
5. Click **Test connection** to verify.

## Loading in Chrome (development)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this directory
4. Add PNG icons to `icons/` (see `icons/README.md` for the required sizes)

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

| Endpoint                           | Method | Description                      |
| ---------------------------------- | ------ | -------------------------------- |
| `/api/import/status`               | GET    | Check connection                 |
| `/api/import/parties`              | GET    | List parties                     |
| `/api/import/ddb-token`            | POST   | Send cobalt-token (DDB)          |
| `/api/import/ddb/characters`       | GET    | List DDB characters              |
| `/api/import/ddb/campaigns`        | GET    | List DDB campaigns               |
| `/api/import/ddb/import`           | POST   | Import DDB characters            |
| `/api/import/foundry/connect`      | POST   | Connect & discover packs         |
| `/api/import/foundry/packs`        | GET    | Get discovered actor packs       |
| `/api/import/foundry/import`       | POST   | Import actor packs               |
| `/api/import/foundry/rolltables`   | POST   | Import roll-table packs          |
| `/api/import/foundry/release`      | POST   | Close Foundry socket             |
