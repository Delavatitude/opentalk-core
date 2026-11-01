# Operating OpenTalk

Use Node 24+ on a server with persistent local storage. Run `npm ci`, create the
administrator with `npm run admin:create`, then `npm run build`. Start with
`NODE_ENV=production npm start` behind an HTTPS reverse proxy. The proxy must serve
the same origin for the UI and API. Set APP_ORIGIN to the exact public HTTPS origin,
without a trailing slash; it is trusted configuration, not a request Host header.

Configuration:

- HOST: listen address, default 127.0.0.1. Set 0.0.0.0 inside a container.
- PORT: API and built frontend port, default 3001.
- APP_ORIGIN: exact browser origin, default http://localhost:5173 for development.
- DATABASE_PATH: local SQLite file, default ./data/opentalk.sqlite.
- RESEND_API_KEY / RESEND_FROM: optional server-side email credentials.
- SMS_PARTNER_API_KEY: optional SMS provider secret; only explicit admin actions send SMS.
- BOOKING_BRAND_NAME, BOOKING_HOST_NAME and other BOOKING_* values: optional server defaults.

Credentials belong in an untracked .env file or your process manager's secret store.
The browser cannot read these. Runtime business settings belong in administration.
Outbound email needs a verified sender and a public HTTPS URL; adding credentials
permits real provider traffic. Local tests never configure production credentials.

The server uses socket peer addresses for throttling, not X-Forwarded-For. Behind
a reverse proxy callers share an IP bucket; add trusted per-client proxy rate limits
before increasing the current 120 requests/minute per peer, 1200 writes/minute per
instance and 10 login attempts/minute. Limits are stored in SQLite and shared by
processes using the same file. Do not put SQLite on a shared network filesystem.

To reset a forgotten administrator password locally:

```sh
npm run admin:create -- --reset-password
```

This revokes all sessions for the account. It does not send a recovery email.

## Backup and restore

`node --env-file-if-exists=.env server/backup.ts /secure/path/backup.sqlite`
uses SQLite's online backup API. The backup contains personal data, password hashes
and sessions: keep it private, encrypted where appropriate, and outside the repo.
To restore, stop the server, keep a copy of its current data directory, replace the
database with the backup, remove old WAL/SHM sidecars only while the server is stopped,
then restart. Test restore on an isolated installation before relying on backups.
No automatic retention or backup rotation is configured.

## Docker

```sh
docker compose build
docker compose run --rm app npm run admin:create
docker compose up -d
```

Compose serves a local build at http://localhost:3001 and persists `/app/data` in a
named volume. Set APP_ORIGIN and NODE_ENV appropriately behind your HTTPS proxy.
Container build/run is provided for operators and is not locally verified here.

## Optional reminders

Reminders are not scheduled automatically. An operator can run
`node --env-file-if-exists=.env server/reminders.ts` from cron or a process manager.
This is a privileged local command against the configured database, not a public
unauthenticated cron endpoint. Run at most one reminder job at a time. Configuring
provider secrets allows real messages. Provider acceptance is not delivery proof.
