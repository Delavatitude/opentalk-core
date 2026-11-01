# Contributing

Contributions use the MIT license. Retain relevant third-party notices.
Use Node 24+ and run npm ci, npm run check, npm run notices and npm audit.
CI exercises Node 24 and 26. Use only synthetic records and mocked providers in tests.
Never include personal data, .env files, database files, credentials or screenshots
of private appointments in a patch.

Keep domain logic separate from infrastructure. New privileged endpoints need
server-side authorization. Every booking write must retain database-level conflict
protection; never replace it with a process-local mutex. PostgreSQL or calendar
adapters must bring real persistence/provider boundary tests and failure handling.
Document changes to schema versions, configuration, installation and limitations.
