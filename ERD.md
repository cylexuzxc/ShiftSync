# ShiftSync Database ERD

```mermaid
erDiagram
    USERS ||--o{ SCHEDULES : receives
    SHIFTS ||--o{ SCHEDULES : defines
    USERS o|--o{ SCHEDULES : assigns
    USERS ||--o{ LEAVE_REQUESTS : submits
    USERS o|--o{ LEAVE_REQUESTS : reviews
    USERS o|--o{ SHIFTS : creates

    USERS {
        int user_id PK
        varchar employee_no UK
        varchar first_name
        varchar last_name
        varchar email UK
        varchar password_hash
        enum role
        varchar department
        enum status
        timestamp created_at
    }
    SHIFTS {
        int shift_id PK
        varchar shift_name UK
        time start_time
        time end_time
        char color
        int created_by FK
        timestamp created_at
    }
    SCHEDULES {
        int schedule_id PK
        int employee_id FK
        int shift_id FK
        date work_date
        int assigned_by FK
        text notes
        timestamp created_at
    }
    LEAVE_REQUESTS {
        int leave_request_id PK
        int employee_id FK
        enum leave_type
        date start_date
        date end_date
        text reason
        enum status
        int reviewed_by FK
        datetime reviewed_at
        text admin_remarks
        timestamp created_at
    }
```

## Relationship notes

- One user (employee) can have many schedule records; each schedule is assigned to one employee.
- One shift type can be used in many schedule records; each schedule uses one shift type.
- An administrator/user may assign many schedules. `assigned_by` is nullable if the assigning account is later removed.
- One employee can submit many leave requests; each request belongs to one employee.
- An administrator/user may review many leave requests. `reviewed_by` and `reviewed_at` remain empty until a decision is made.
- A user may create multiple shift types. `created_by` is optional.
- `uq_schedule_employee_date` means this version allows at most one assigned shift per employee per date. Remove or adjust that constraint if split shifts are required.
- The `users` table stores a `password_hash`, never a plaintext password. The frontend demo password is only for the local prototype and must not be reused as backend authentication.
