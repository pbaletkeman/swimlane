# About

Setup the database used by this app locally in Docker

## PostgreSQL

Creates and starts a PostgreSQL 18 server in Docker using these settings:

- POSTGRES_USER: postgres
- POSTGRES_PASSWORD: postgres
- POSTGRES_DB: appdb

## PG Admin

Creates a PG Admin containier to help manage the PostgreSQL instance using these settings:

- PGADMIN_DEFAULT_EMAIL: admin@example.com
- PGADMIN_DEFAULT_PASSWORD: admin
