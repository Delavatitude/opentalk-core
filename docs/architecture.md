# Architecture

```text
React / Vite UI → same-origin /api → Node HTTP server
                                    ├─ local auth + SQLite sessions
                                    ├─ booking / CRM / page handlers
                                    ├─ portable availability / timezone rules
                                    ├─ SQLite entity repository + overlap triggers
                                    └─ optional provider adapters
```

`src/api/client.js` is the small application HTTP client. It contains no provider
SDK and stores no authentication token in localStorage. `server/app.ts` routes an
explicit inventory of booking functions; all other functions and every direct
entity operation require an administrator. Public functions derive their own
limited response projections from stored records. Local accounts are separate
from business records, and the User entity is not exposed.

`server/shared` contains the extracted availability, timezone, contact, page and
notification logic. Existing handler names remain available for the UI.
`server/context.ts` supplies request-scoped services with AsyncLocalStorage;
`server/runtime.ts` tracks optional follow-up work that the local server awaits.
No platform runtime or network database shim is used.

`server/database.ts` creates the v1 schema automatically. Business entities are
JSON records in SQLite, described in `server/schemas`. Filtering, ordering and
pagination are translated to bound SQL queries. Accounts, session hashes and rate
buckets have separate tables. Private business data never has anonymous CRUD.

Every booking write computes numeric occupied bounds with buffer snapshots.
SQLite BEFORE INSERT/UPDATE triggers reject overlaps with another active booking
inside the database write transaction. This works across local processes on the
same database file. It is not an in-memory lock. Moving a booking into an occupied
interval rolls back that statement and keeps the previous interval.

The deployment model is one organization, one local SQLite database on a persistent
disk. It is not a multi-tenant SaaS or a multi-region write architecture. A future
PostgreSQL adapter needs its own equivalent atomic exclusion constraint.

Optional external-provider modules are server-only. Calendar credential resolution
currently rejects requests rather than implicitly connecting to a hosted platform.
No previous account, production record, secret or Git history was imported.
