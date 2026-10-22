# ShiftSync

ShiftSync is a browser-based workplace scheduling and leave-management prototype with a PHP/MySQL authentication backend. Login credentials and sessions are checked server-side; schedules, leave requests, swaps, time logs, notifications, profiles, and payroll summaries still use in-memory sample data and are not persisted.

## Run locally

For the complete same-origin PHP application and login flow, run the Docker Compose services:

```sh
docker compose up -d --build
```

Open [http://localhost:8080](http://localhost:8080). The PHP built-in server is for local development only; do not expose it directly as a production web server.

`npm start` on port 8000 remains available for static visual previews, but that separate origin does not serve the PHP authentication endpoints. Use port 8080 for login testing.

## Demo sign-in

The login screen is shown by default. The server accepts these designated fictional demonstration accounts with password `demo123` only when `DEMO_MODE=true`:

| Role | Email |
| --- | --- |
| Employee | `employee@shiftsync.ph` |
| Administrator | `admin@shiftsync.ph` |

The accounts are stored in the database with password hashes. Demo account creation and demo-account login require `DEMO_MODE=true`; the seed script refuses production environments and accepts only the dedicated development or demonstration database names. Do not use real employee information or point the public demo at a workplace database. The login page's existing warning still says “Frontend demo only”; it was intentionally left unchanged to preserve its approved appearance and needs approval for a future text-only correction.

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

1. Ensure the ignored local `.env` contains database credentials matching the already-initialized MySQL accounts, plus `APP_ENV=development` and `DEMO_MODE=true`. Use distinct random values for the database user and MySQL root account. Do not commit credentials or expose them in shared files. If MySQL returns access denied, restore the existing database account credentials or provision a separate fresh development database; do not delete the persistent volume to reset credentials.
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

5. Seed or verify the two fictional accounts only in the development demo database:

   ```sh
   docker compose exec -e DEMO_MODE=true -e DEMO_PASSWORD=demo123 app php bin/seed-demo.php
   ```

   This command is idempotent for the two designated demo records. It refuses conflicting/inactive records, production mode, and databases outside the configured development/demo database names. It updates a password hash only when the matching marked demo account exists and the current hash does not match the supplied demo password.

For a public academic demo, use a separate database named `shiftsync_demo` containing only fictional records, configure `APP_ENV=demo`, `DB_NAME=shiftsync_demo`, and `DEMO_MODE=true`, and set `SESSION_COOKIE_SECURE=true` behind HTTPS. Use a dedicated database account scoped to that database, terminate HTTPS at a maintained production web server, and keep database ports private. Do not use this development Compose server as a public production deployment. To reset demo data, provision a fresh isolated demo database and run the guarded migration and seed commands against it; do not drop tables or delete the persistent development volume.

Authentication endpoints:

- `POST /api/login.php` — verifies the active account and password hash, rotates the session ID, and returns safe profile fields plus the CSRF token.
- `GET /api/session.php` — validates the current active database account and returns the current session (or no user) with a CSRF token.
- `POST /api/logout.php` — checks the CSRF token, destroys the server session, and expires its cookie.

Session cookies are HttpOnly and SameSite=Lax, with a 30-minute idle timeout. The Secure flag follows HTTPS by default; set `SESSION_COOKIE_SECURE=true` when TLS is terminated by a reverse proxy that does not expose HTTPS to PHP. The UI receives the authenticated role from the server session. There are no business-operation APIs yet, so dashboard role checks are still presentation behavior—not server authorization for schedules, leave, swaps, payroll, or other data. All dashboard edits remain in-memory and reset on reload.
