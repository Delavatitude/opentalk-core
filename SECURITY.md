# Security

This is an initial standalone release. See docs/release-status.md for its verified
scope and open limitations. Accounts are provisioned by a local operator; there is
no public signup or default administrator. Passwords use salted scrypt. Sessions
are random opaque cookies stored as hashes with seven-day expiry and server-side
revocation. Public HTTPS installs use Secure, HttpOnly, SameSite=Strict cookies.

Direct entity operations and privileged functions require an admin on the server.
Public reservation functions expose explicit response projections. POST requests
require JSON and a custom header; a supplied Origin must match APP_ORIGIN. No CORS
or untrusted forwarded-header bypass is enabled. Rate limits persist in SQLite.

Keep provider secrets, .env files, SQLite databases/backups, private notes, session
cookies and booking-management links out of Git and public issues. Use HTTPS for
public installations and restrict OS access to the persistent data directory.
Management links are bearer credentials; expiry and a dedicated revocation UI are
not implemented yet. Configure data retention and test backups for your use case.

Report vulnerabilities through GitHub private security reporting when enabled.
If unavailable, request a private contact from the maintainer without disclosing
exploit details, personal information, credentials or management links publicly.
