# ShiftSync

ShiftSync currently has a browser-only workplace scheduling and leave-management frontend. A separate PHP/MySQL development foundation is being introduced, but dashboard data and authentication are not connected to it.

## Run locally

Open `index.html` in a modern browser, or serve this directory:

```sh
npm install
npm start
```

Then visit [http://localhost:8000](http://localhost:8000). Until a later API integration phase, dashboard records and profile edits are held in memory and reset when the page is refreshed.

## Demo sign-in

The login screen is shown by default. Use one of these sample accounts with password `demo123`:

| Role | Email |
| --- | --- |
| Employee | `employee@shiftsync.ph` |
| Administrator | `admin@shiftsync.ph` |

This is **not secure authentication**. The account list and demo password are shipped to the browser, and role checks are only frontend behavior. Do not use real credentials or sensitive data. Unknown emails and incorrect passwords are rejected. Public registration, quick-login bypasses, and role switching are not provided. Real authentication and authorization require the planned PHP/MySQL backend, password hashing, sessions, and server-side checks.

## Implemented prototype workflows

- Candidate-based ShiftSync Enterprise dashboard with the emerald/green visual design, sidebar navigation, live time tracker, metrics, and upcoming-shift roster.
- Monday-to-Sunday weekly schedule and Monday-first monthly calendar with navigation; administrator shift assignment and roster management.
- Shift roster search/filter and printing.
- Team directory using sample profile data.
- Leave request submission with date-range validation, overlapping-request checks, and administrator approval/rejection.
- Shift-transfer requests to a coworker; administrator approval transfers the requested assignment only when the shift still exists and the recipient has no same-day shift or approved leave.
- In-memory clock-in/out records, activity log, and CSV export.
- Labor/payroll estimates calculated from sample hourly rates and assigned shift durations. These are planning estimates, not payroll results.
- Editable demo profile fields, in-app notifications, and light/dark themes.

All mutations are local to the current browser page. No action writes to a backend, sends a real notification, or persists after refresh.

## Project files

- `index.html`, `style.css`, `app.js` — application shell, styles, and frontend behavior.
- `data.js` — sample users, shifts, schedules, leave requests, notifications, and in-memory records.
- `ERD.md`, `schema.sql` — database design for a future backend; neither is executed by this prototype.
- `shiftsync-candidate.html` — not present in this workspace checkout; the current `index.html`, `style.css`, `app.js`, and `data.js` are the source of truth.
- `presentation/` — existing presentation assets. They have been preserved and not regenerated as part of this interface integration.

## QA

Run `npm test` to execute the Playwright browser checks. The test suite exercises login validation, employee/admin navigation, leave review, schedule assignment, shift transfers, time logs, CSV downloads, profile/theme/notification controls, and layout at desktop, tablet, and mobile viewports. Tests do not overwrite the existing presentation images.

## PHP + MySQL development foundation

The backend foundation uses Docker Compose because this Codespaces image has Docker but does not include the PHP MySQL PDO extension or a MySQL server. The database stores data in the persistent `shiftsync_mysql_data` volume and does not publish port 3306. In this Codespaces environment, the PHP container shares the database container's private network namespace; only the PHP HTTP port is bound to `127.0.0.1:8080`. The PHP service includes `pdo_mysql` and serves only the generic database health endpoint; the frontend is not connected to it yet. The development database user has schema-level privileges only on `shiftsync_dev` so it can run the initializer; production should use separate, least-privilege runtime and migration accounts.

1. Copy `.env.example` to `.env` and replace both password placeholders with different, randomly generated development-only passwords. Do not commit `.env`.
2. Build and start the services:

   ```sh
   docker compose up -d --build
   ```

3. Test the database connection and initialize only a fresh development database:

   ```sh
   docker compose exec app php bin/db-test.php
   docker compose exec app php bin/migrate.php
   docker compose exec app php bin/verify-schema.php
   ```

4. Check the generic health response at [http://localhost:8080/health.php](http://localhost:8080/health.php). Codespaces may ask you to forward port 8080 for browser access.

The migration refuses to initialize a database containing untracked application tables. It does not drop, truncate, or migrate existing data. Do not delete the named volume to reset the database. The host PHP installation does not have `pdo_mysql`; run backend PHP commands through the Compose `app` service. Keep the frontend running separately with `npm start` on port 8000.

Phase 1 provides only environment-based PDO configuration, a guarded fresh-schema initializer, a connection check, table verification, and a health endpoint. It does **not** implement login, sessions, authorization middleware, or feature APIs.
