# ShiftSync

ShiftSync is a workplace shift scheduling and leave management prototype. Employees can review their schedules and submit leave requests; administrators can assign shifts and review requests. The prototype uses in-memory sample data and does not connect to PHP or MySQL.

## Run the prototype

Open `index.html` in a modern browser, or serve the project directory locally:

```sh
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000). No package installation or build step is required. Demo changes reset when the page is refreshed.

## Demo accounts

Use either the sign-in form or the instant demo buttons:

| Role | Email | Password |
| --- | --- | --- |
| Employee | `ana@shiftsync.demo` | `demo123` |
| Administrator | `admin@shiftsync.demo` | `demo123` |

This demo login is not secure authentication. Do not use real credentials or sensitive data.

## Features

- Employee dashboard with upcoming shifts, a weekly schedule, and recent leave requests.
- Leave submission with required-field, date-order, and reason validation.
- Administrator dashboard with employee, shift, pending-request, and daily staffing counts calculated from the sample data.
- Weekly schedule management with previous/current/next week navigation, shift assignment, editing, deletion, and shift-type management.
- Leave approval and rejection; a remark is required to reject a request.
- Responsive navigation, tables, and schedule grid for desktop through mobile viewports.

## Project files

- `index.html`, `style.css`, and `app.js` — the frontend prototype.
- `data.js` — in-memory demo users, schedules, shifts, and leave requests.
- `ERD.md` and `schema.sql` — database design documentation for a future backend.
- `presentation/` — presentation assets.
