# Copilot instructions for ShiftSync

## Project snapshot

ShiftSync is a browser-only scheduling prototype for employee shift assignment and leave management. It uses a single-page HTML/CSS/JavaScript UI and in-memory sample data. There is no backend, database connection, or persistence layer in the current app; changes reset on page refresh.

## Build, test, and validation commands

No formal build step or linter is configured for this project.

- Install dependencies:
  - `npm install`
- Run the app locally:
  - `npm start`
  - Or directly: `python3 -m http.server 8000`
- Open the app in a browser at `http://localhost:8000`
- Run the smoke test suite:
  - `npm test`
- Run just the Playwright smoke script directly if needed:
  - `node qa-check.js`

The repository's smoke test validates the employee/admin demo flows, leave approval/rejection logic, and the seven-day schedule layout at 1366px. It writes screenshots under `presentation/`.

## High-level architecture

- `index.html` is the single app shell. It renders the login screen and the main app layout, then loads `data.js` and `app.js`.
- `data.js` contains the in-memory `DB` object and seed data for users, shifts, schedules, and leave requests. This is the system's source of truth while the prototype is running.
- `app.js` implements the UI logic:
  - a global `S` state object tracks the logged-in user and current view/week
  - `VIEWS` defines role-based render functions for employee and admin screens
  - DOM event listeners and `data-act` button attributes drive navigation, leave submission, shift editing, and admin review workflow
  - helper functions such as `scheduleConflicts()`, `onLeave()`, and `updateLeaveDateControls()` enforce the prototype's business rules
- `style.css` contains the prototype's layout, responsive behavior, badges, cards, and scheduling grid styling.
- `qa-check.js` is the automated smoke test used by `npm test`; it exercises the app through Playwright and validates screenshots plus key interactions.
- `ERD.md` and `schema.sql` model the planned backend data layer. The live prototype does not yet hit a server, but the schema already matches the domain semantics: `users`, `shifts`, `schedules`, and `leave_requests`.

## Backend and database context

The database design is already codified in `schema.sql` and `ERD.md` and should be treated as the canonical backend model if the project shifts from the prototype into a live implementation.

- Core tables:
  - `users`: one account table for both admins and employees; roles are split via `role`, and passwords are intentionally stored as PHP `password_hash()` output rather than plaintext.
  - `shifts`: reusable shift templates with a unique name, times, and color metadata.
  - `schedules`: one assignment per employee per date (`UNIQUE (employee_id, work_date)`), with the shift assigned to a specific date and optional notes.
  - `leave_requests`: leave records with start/end dates, status lifecycle, and admin review metadata.
- Domain rules to preserve in any backend port:
  - only admins assign shifts or review leave
  - one employee may not have more than one shift on the same date
  - leave requests cannot overlap another pending or approved request for the same employee
  - a rejection must include an admin remark
  - approved leave should block a shift assignment for that employee on that date
- Data mapping from the current frontend prototype to the database model:
  - `name` becomes split `first_name` and `last_name`
  - `no` maps to `employee_no`, `dept` to `department`
  - day/time values in `data.js` align with `work_date`, `start_time`, and `end_time`
  - leave request fields (`type`, `start`, `end`, `reason`, `status`, `remarks`) map directly to the `leave_requests` table
- The schema is intentionally designed for MySQL 8.0+/MariaDB and does not add extra tables for the current feature set. Do not introduce a new data model unless the backend work explicitly requires it.

## Key conventions

- Treat this as a static UI prototype, not a full web app. Do not add server-side code, APIs, or persistence unless the task explicitly requires it.
- Keep business logic in the existing in-memory data model and helper functions instead of creating parallel state stores.
- Dates are stored as `YYYY-MM-DD` strings and are manipulated with the existing helpers (`ymd`, `mon`, `add`, `dateFromYMD`, `validYMD`). Reuse those helpers rather than introducing new date parsing patterns.
- The app uses direct DOM generation with template strings. Reuse the existing `esc()` helper for user-generated text before injecting it into HTML.
- UI actions are keyed by `data-act` and `data-form`; follow the current patterns for new interactions instead of introducing a different event model.
- Role-specific behavior is intentional: employee screens and admin screens are separate views (`NAV.employee`, `NAV.admin`) and should remain aligned with the demo-user model in `data.js`.
- Leave and shift validation rules are centralized in helper logic; avoid duplicating conflict checks in ad hoc places.
- Demo credentials are intentionally fake and should remain demo-only; do not treat this as real authentication or authorization.

## Working style for this repo

- Prefer targeted, browser-only changes that fit the current prototype structure.
- The main verification path is to run the app locally and run `npm test` or `node qa-check.js` after UI changes.
- Screenshot artifacts in `presentation/` are part of the project verification flow and should be regenerated only when the UI changes in a way that needs fresh captures.
- Keep edits consistent with the existing single-file app conventions rather than introducing a framework or build pipeline unless the project explicitly evolves beyond the prototype stage.
