# ShiftSync Presentation Checklist

This checklist records what was inspected in the workspace. A file existing is not proof that it shows the current application.

## Status key

- **Completed and verified:** opened or checked in this workspace.
- **Completed, not independently verified:** a deliverable exists, but its content or correspondence was not fully verified.
- **Still requires manual action:** needs a live browser capture or check unavailable in this environment.

## 1. Current Interface Preview

| Item | Status | Notes |
| --- | --- | --- |
| `current-interface.png` login preview | Completed and verified | Opens as a non-empty PNG (1366 × 820). It depicts the older login design and must be recaptured to represent the current UI. |
| Current login and sidebar in a live browser | Still requires manual action | Browser-based visual comparison was unavailable. |

## 2. Dashboard and Management Preview

| Item | Status | Notes |
| --- | --- | --- |
| `employee-dashboard.png` | Completed and verified | Opens as a non-empty PNG (1366 × 820), but depicts the older interface. Recapture from the current app. |
| `admin-dashboard.png` | Completed and verified | Opens as a non-empty PNG (1366 × 820), but depicts the older interface. Recapture from the current app. |
| `schedule-management.png` | Still requires manual action | Zero bytes; left untouched. Capture the current admin weekly schedule. |
| `leave-management.png` | Still requires manual action | Zero bytes; left untouched. Capture the current admin leave-review screen. |
| Current app views, interactions, and responsive layouts in a browser | Still requires manual action | No browser executable or browser automation tool was available for this QA run. |

## 3. Database ERD

| Item | Status | Notes |
| --- | --- | --- |
| `ShiftSync_ERD.png` | Completed and verified | Opens as a non-empty PNG (1920 × 1600). Its four entities and displayed relationships correspond to `ERD.md` and `schema.sql`. |
| `ShiftSync_ERD.svg` | Completed and verified | Opened in the workspace preview. |
| `shiftsync-erd.png` | Completed and verified | Opens as a non-empty PNG (1568 × 1676); appears to be an older ERD export. |
| Compare ERD with database files after future changes | Still requires manual action | Recheck whenever `ERD.md` or `schema.sql` changes. |

## Manual capture instructions

1. Start the frontend from the workspace with `python3 -m http.server 8000`.
2. Open the forwarded port in the Codespaces **Ports** panel.
3. Capture the actual rendered application with the browser screenshot feature (not a recreated mockup).
4. Replace the stale `current-interface.png`, `employee-dashboard.png`, and `admin-dashboard.png` only after checking the new captures.
5. Capture the schedule and leave screens into `schedule-management.png` and `leave-management.png`. Do not submit the existing zero-byte placeholders as finished images.
6. Open each capture and confirm it is a non-empty PNG depicting the current application.

The frontend remains a sample-data prototype; the database schema has not been run against MySQL and PHP + MySQL integration remains a later milestone.
