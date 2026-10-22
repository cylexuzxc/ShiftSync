# ShiftSync

ShiftSync is a workplace shift scheduling and leave management prototype. Employees can review their schedules and submit leave requests; administrators can assign shifts and review requests. The prototype uses in-memory sample data and does not connect to PHP or MySQL.

## Run the prototype

Open `index.html` in a modern browser, or serve the project directory locally:

```sh
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000). No package installation or build step is required. Demo changes reset when the page is refreshed.

## GitHub Codespaces and local QA

From the terminal in Codespaces or your local clone:

```sh
npm install
npm start
```

In a second terminal, run:

```sh
npm test
```

`npm start` serves the current frontend on port 8000. `npm test` runs the Playwright-based QA smoke test that validates the main employee/admin flows, leave approval/rejection logic, and the seven-day schedule layout at 1366px.

## Demo accounts

Use either the sign-in form or the instant demo buttons:

| Role | Email | Password |
| --- | --- | --- |
| Employee | `ana@shiftsync.demo` | `demo123` |
| Administrator | `admin@shiftsync.demo` | `demo123` |

This demo login is not secure authentication. Do not use real credentials or sensitive data.

## Features

- Employee dashboard with upcoming shifts, a weekly schedule, and recent leave requests.
- Leave submission with local-date validation, overlapping-request prevention, and visible schedule-conflict warnings.
- Administrator dashboard with employee, shift, pending-request, and daily staffing counts calculated from the sample data.
- Weekly schedule management with year-inclusive week navigation, a shift-color legend, keyboard-accessible assignment cells, historical-shift editing, and shift-type management.
- Leave approval and rejection; a remark is required to reject a request.
- Responsive navigation, tables, and schedule grid for desktop through mobile viewports.

## Project files

- `index.html`, `style.css`, and `app.js` — the frontend prototype.
- `data.js` — in-memory demo users, schedules, shifts, and leave requests.
- `ERD.md` and `schema.sql` — database design documentation for a future backend.
- `presentation/` — presentation assets.

## Presentation materials

- `presentation/current-interface.png`, `presentation/employee-dashboard.png`, and `presentation/admin-dashboard.png` were recaptured in-browser during this QA pass and verified as non-empty PNGs showing the current UI.
- `presentation/schedule-management.png` and `presentation/leave-management.png` were also captured in-browser during this QA pass and verified as non-empty PNGs showing the current schedule and leave-management screens.
- `presentation/ShiftSync_ERD.png` is the verified ERD preview; `presentation/ShiftSync_ERD.svg` is the editable vector copy.
- `presentation/ShiftSync_Presentation_Checklist.md` records the verified status for this prototype snapshot; no additional browser capture is required unless the UI changes again.

## Verification status

- Frontend QA performed in-browser with Playwright: demo employee login, admin login, schedule navigation, leave submission, approval/rejection controls, weekly schedule at 1366px, and responsive layout checks.
- Console errors: none observed during the smoke test.
- Remaining manual tasks: none for this snapshot. If the interface changes further, re-run the captures and PDF/image validation before the next presentation.

## Prototype limitations

The app has no server or persistence. Schedule assignments, leave submissions, and review actions modify only in-memory demo data and reset on refresh. Demo credentials are for preview only, not secure authentication. The proposed SQL schema has not been executed against a database.
