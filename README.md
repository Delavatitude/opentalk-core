# OpenTalk Core

Open-source, self-hosted appointment booking for one organization per installation.
React interface, Node.js backend, SQLite database and local administrator accounts.
No Base44 SDK, account, app ID or hosted backend is required.

**Version 0.2 is an initial standalone release.** The local booking lifecycle is tested;
calendar account connections, hosted MCP/OAuth and SaaS subscriptions are not included.

## Run locally

Requirements: Node.js **24 or newer**, npm and a writable local disk.

```sh
git clone https://github.com/Delavatitude/opentalk-core.git
cd opentalk-core
npm ci
cp .env.example .env
npm run admin:create
npm run dev
```

Open **http://localhost:5173/login** and sign in with the administrator you created.
In **My page** or **Setup**, configure your identity, timezone and local public URL
`http://localhost:5173`, create an appointment type, add working hours and publish
your homepage. Visitors can then book at **http://localhost:5173/**.
There is no open administrator registration or default password. A fresh homepage
has no published appointments until its owner configures it.

The development command starts both the API on `127.0.0.1:3001` and Vite on port
5173. Use `localhost:5173` consistently so the configured origin and cookies match.
SQLite creates `data/opentalk.sqlite` automatically. No external database server,
email account, calendar connection or provider credential is needed to book.

## Run the built application

```sh
npm run build
# Set .env: APP_ORIGIN=http://localhost:3001 for a local build preview
npm start
```

The Node server serves the frontend and `/api` together on port 3001.
For a public server, use an HTTPS reverse proxy, set `NODE_ENV=production`, and set
`APP_ORIGIN=https://your-domain.example`. See [deployment](docs/deployment.md).
A Dockerfile and Compose configuration are included; Docker deployment has not
been exercised in this development environment.

## Features

- Public booking pages, appointment types, working hours and blocked periods.
- Visitor timezones, French/English content, cancellation and rescheduling links.
- Administrator dashboard, contacts, private call notes and page publication.
- Local passwords hashed with scrypt; revocable, expiring HttpOnly cookie sessions.
- SQLite conflict checks protect booking inserts and updates across processes,
  including buffers. Tests race two independent worker connections.
- Optional Resend email and SMS Partner delivery adapters. No credentials by default.

Calendar business code is retained behind an adapter boundary. This release has
**no calendar credential/OAuth connector**: Google/Wix account connection controls
are disabled and connectors fail closed. Calendar or Meet synchronization is not
part of the verified standalone workflow. Booking works with a fixed location or
meeting link. Email/SMS integration tests simulate providers; they do not prove
live delivery. Automated reminders require the optional operator job described in
the deployment guide.

## Development

```sh
npm run check          # lint, domain/API tests, build, source credential scan
npm run notices        # dependency license inventory
npm audit --audit-level=high
```

Tests use synthetic records and temporary SQLite files. No real email, SMS or
calendar event is sent. CI checks Node 24 and 26. There is no claim that the legacy
JavaScript UI passes a full TypeScript migration.

See [architecture](docs/architecture.md), [security](SECURITY.md),
[limitations](docs/release-status.md) and [contributing](CONTRIBUTING.md).

## License

[MIT](LICENSE). Dependency inventory: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
