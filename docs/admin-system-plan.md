# FAYGEN BARBER admin system plan

## Audit summary
- The public website is a polished static/mostly static Next.js experience with an existing booking flow and Supabase integration.
- The current admin area is lightweight and mostly placeholder-based, with basic login and sidebar pages.
- The booking flow already depends on Supabase-backed availability and appointment records, so the new admin system should extend those tables rather than replace them.
- The existing public homepage is visually rich and should remain intact; dynamic content will be layered in without changing the current design.

## Conflicts to address
- The existing migrations use older table names such as `open_slots`, `blocked_times`, `gallery_images`, and `business_settings`, while the requested admin system expects a broader schema. The implementation will add new tables and columns while preserving the existing data model.
- The current admin UI uses simple table views and browser-only calls; the new version will add protected server-side routes and role-aware access checks.
- The existing booking availability logic uses `services.duration_minutes` to calculate slot availability, but the admin system needs fixed 30-minute booking slots. The implementation will keep the public booking logic compatible with 30-minute slots while allowing the admin UI to manage availability explicitly.

## Implementation order
1. Create database migration files for profiles, permissions, customers, availability slots, content, activity logs, and version history.
2. Add shared admin helpers for authentication, roles, and permissions.
3. Build the protected admin layout, dashboard, and navigation shell.
4. Implement appointments, availability, services, gallery, content, settings, and user-management pages.
5. Connect the public homepage to dynamic services, gallery, content, and settings data while preserving the current design.
6. Verify with a production build.
