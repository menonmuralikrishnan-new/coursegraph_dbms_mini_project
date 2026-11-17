# CourseGraph

CourseGraph is a working full-stack MVP for prerequisite-aware course enrollment and timetable conflict resolution.

## Stack

- Frontend: React + Vite
- API: Node.js + Express
- SQL: PostgreSQL for transactional academic data and constraint enforcement
- NoSQL: MongoDB for course-search documents, audit events, and recommendation metadata

## Run locally

1. Install Node.js 20+ and Docker Desktop.
2. Copy `server/.env.example` to `server/.env`.
3. Run `docker compose up -d postgres mongo`.
4. Run `npm install` in `server` and `client`.
5. Run `npm run migrate` and `npm run seed` in `server`.
6. Start the API with `npm run dev` in `server`.
7. Start the UI with `npm run dev` in `client`.

The UI opens at `http://localhost:5173` and the API at `http://localhost:4000`.

The SQL schema is in `server/sql/001_init.sql`; MongoDB is intentionally used for flexible course-search documents and audit history while PostgreSQL remains the source of truth for enrollment.

## Demo features

- Catalog search with department/day/availability filters, prerequisite paths, and related-course explanations.
- Enrollment checks for prerequisite completion, student timetable clashes, capacity, duplicate enrollment, dropping, and waitlisting.
- Section creation checks that prevent a faculty member or classroom from being double-booked in the same semester.
- Student timetable view plus faculty and classroom utilization views.
- Demo course completion controls and a prerequisite graph view in each course card.
- Demo Student/Admin role selection. Admins can create sections and deliberately load faculty/classroom clash examples to show database rejection in the UI.

After changing the schema or seed data, rerun `npm run migrate` and `npm run seed` from `server` before restarting the API.
