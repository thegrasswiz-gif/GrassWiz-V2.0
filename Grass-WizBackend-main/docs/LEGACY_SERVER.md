# Legacy Express API (`server.js`)

The calendar used to talk to this Node/MySQL server (hosted on GoDaddy). It now uses Supabase directly, so **the app does not need or call this server**. It is kept only for reference and for any deployment that still exists.

If you are not running it anywhere, you can delete `server.js`, `package.json`, `package-lock.json`, `.env.example` and the `legacy/` folder.

## If you do run it
It is locked down and will not start without configuration:
1. Copy `.env.example` to `.env` and fill it in. `API_KEY` (16+ characters) and `DB_PASSWORD` are mandatory.
2. Every `/api/*` and `/uploads/*` request must send the header `X-API-Key: <your API_KEY>`. The old open endpoints are gone: `/api/setup` is now `POST` and needs the key, uploaded documents are no longer public.
3. Browsers may only call it from the origins listed in `ALLOWED_ORIGINS`.
4. Uploads are limited to PDFs and images up to 10 MB. Errors return a generic message; details go to the server log.
5. `npm install`, then `npm start`.

The browser app has no way to send the API key, so it cannot use this server any more — which is intended.

`legacy/server-backup-OLD-insecure.js` is an older copy from before this hardening. Do not deploy it.
