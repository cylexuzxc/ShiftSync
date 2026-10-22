# ShiftSync Presentation Checklist

This checklist records what was inspected in the workspace. A file existing is not proof that it shows the current application.

## Status key

- **Completed and verified:** checked in this workspace and confirmed by browser QA or file validation.
- **Completed, not independently verified:** a deliverable exists but was not rechecked in-browser during the final QA pass.
- **Still requires manual action:** needs further browser/screenshot work or has not been re-captured since a UI change.

## 1. Current Interface Preview

| Item | Status | Notes |
| --- | --- | --- |
| `current-interface.png` login preview | Completed and verified | Captured in-browser during the QA pass and is a non-empty PNG. |
| `employee-dashboard.png` | Completed and verified | Captured in-browser after signing in as the employee demo user. |
| `admin-dashboard.png` | Completed and verified | Captured in-browser after signing in as the admin demo user. |
| Browser-based validation of current login and sidebar | Completed and verified | Playwright loaded the app and completed login and navigation flows at 1366×820. |

## 2. Dashboard and Management Preview

| Item | Status | Notes |
| --- | --- | --- |
| `schedule-management.png` | Completed and verified | Captured in-browser from the admin schedule-management view. |
| `leave-management.png` | Completed and verified | Captured in-browser from the admin leave-management view. |
| Current app views, interactions, and responsive layouts in a browser | Completed and verified | Smoke test covered demo login, employee/admin navigation, leave submission, approval/rejection, weekly schedule fit, and console error checks. |

## 3. Database ERD

| Item | Status | Notes |
| --- | --- | --- |
| `ShiftSync_ERD.png` | Completed and verified | Opens as a non-empty PNG and matches the documented four entities in `ERD.md` and `schema.sql`. |
| `ShiftSync_ERD.svg` | Completed and verified | Opened in the workspace preview. |
| `shiftsync-erd.png` | Completed and verified | Exists as a non-empty PNG but is a separate older ERD export. |
| Compare ERD with database files after future changes | Still requires manual action | Recheck whenever `ERD.md` or `schema.sql` changes. |

## Browser QA summary

1. Local app server was started and validated at `http://127.0.0.1:8000`.
2. Playwright loaded the page and completed employee + admin demo login flows without console errors.
3. Leave submission, approval, and rejection actions were tested in-browser.
4. The weekly schedule grid was checked at 1366px; all seven days fit within the visible schedule region.
5. Browser errors were recorded during the smoke test and none were observed.

The frontend remains a sample-data prototype; PHP + MySQL integration remains a later milestone and the schema has not been executed against a database.
