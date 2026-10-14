# ShiftSync

**Centralized Workplace Shift & Leave Management System**

ShiftSync is a college project prototype for organizing employee schedules and leave requests in one web interface. The current prototype is built with HTML, CSS and JavaScript and uses sample data. It is not yet connected to a production database.

## Current prototype features
- Demo sign-in for employee and administrator views
- Employee dashboard and schedule viewing
- Online leave request submission in the demo
- Administrator leave review actions
- Schedule assignment and shift-type management in the demo

## Project files
- `index.html` — entry page and interface markup
- `style.css` — interface styling
- `data.js` — sample/demo data
- `app.js` — front-end interactions
- `ERD.md` — database design and Mermaid ER diagram
- `schema.sql` — MySQL DDL draft for the proposed database
- `ShiftSync_ERD.png` / `ShiftSync_ERD.svg` — presentation exports (if copied into the project)

## Run the frontend in Codespaces
1. Open the project in GitHub Codespaces.
2. Start or use the existing local preview server.
3. Open the forwarded port from the **Ports** panel.
4. Use the on-screen demo role buttons to inspect the employee and admin views.

The demo accounts and sample data are for preview only. They are not secure authentication and changes may reset when the page reloads.

## Database design
The proposed MySQL design includes `users`, `shifts`, `schedules`, and `leave_requests`. Review `ERD.md` together with `schema.sql`. **Warning:** the current SQL draft drops and recreates these four tables. Do not run it against a database containing data that must be preserved; use a disposable development database after reviewing the script.

## Planned next phase
Implement the required PHP backend and MySQL integration, including password hashing, role-based authorization, server-side validation, and persistent schedules and leave requests.
