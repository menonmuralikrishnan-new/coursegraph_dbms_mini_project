# CourseGraph
## DBMS Project Report

### Submitted by

| Name | SRN |
|---|---|
| Muralikrishnan Menon | PES2UG24CS288 |
| Naivadh Srivatsav | PES2UG24CS297 |

## 1. Abstract

CourseGraph is a full-stack academic enrollment and timetable management system. It models courses, prerequisites, students, faculty, classrooms, sections, completed courses, and enrollments. The system uses PostgreSQL as the authoritative relational database for transactional academic data and MongoDB for flexible course-search documents and audit events.

The main database feature is constraint-aware enrollment. Before an enrollment is accepted, the system checks prerequisite completion, timetable clashes, available capacity, duplicate course enrollment, and section validity. The project also demonstrates faculty and classroom scheduling constraints, student-specific enrollment data, waitlisting, dropping and re-enrollment, and administrative enrollment visibility.

## 2. Objectives

- Store and manage academic data using a normalized relational schema.
- Represent prerequisite relationships between courses.
- Prevent invalid enrollments using database-level constraints and triggers.
- Detect student timetable conflicts.
- Prevent faculty and classroom double-booking.
- Track capacity, active enrollments, waitlisted students, and dropped enrollments.
- Provide student-specific course selection and timetable views.
- Demonstrate a suitable NoSQL use case with MongoDB.
- Provide administrators with enrollment counts and enrolled-student names.

## 3. Technology Stack

- Frontend: React with Vite
- Backend: Node.js and Express
- Relational DBMS: PostgreSQL 16
- NoSQL DBMS: MongoDB 7
- Database drivers: `pg` and `mongodb`
- Local deployment: Docker Compose

## 4. System Architecture

```text
React client
    |
    | HTTP/JSON REST API
    v
Express server
    |                         \
    | SQL queries              \ MongoDB driver
    v                           v
PostgreSQL                  MongoDB
academic source of truth    search documents and audit events
```

PostgreSQL is the source of truth for data that must remain consistent, such as enrollments, section capacity, prerequisites, and timetable constraints. MongoDB is used where a flexible document structure is useful: denormalized course-search documents and append-oriented audit events.

## 5. Relational Database Design

### 5.1 Main relations

The PostgreSQL schema contains the following relations:

- `students`: student identity and batch year.
- `faculty`: faculty identity and department.
- `courses`: course code, title, description, credits, and department.
- `prerequisites`: many-to-many relationship between courses and prerequisite courses.
- `rooms`: classroom name, building, and physical capacity.
- `sections`: an offering of a course taught by a faculty member in a room at a particular time.
- `enrollments`: student registration state for a section.
- `completed_courses`: courses completed by students, including grade and semester.

### 5.2 Relationships

```text
students 1 ----< enrollments >---- 1 sections >---- 1 courses
students 1 ----< completed_courses >---- 1 courses
courses 1 -----< prerequisites >----- 1 courses
faculty 1 -----< sections
rooms 1 -------< sections
```

The `prerequisites` table is a self-referencing associative relation. Its composite primary key `(course_id, prereq_course_id)` prevents duplicate prerequisite edges, while a check constraint prevents a course from being its own prerequisite.

### 5.3 Important integrity constraints

- Primary keys identify every entity and transaction record.
- Foreign keys prevent orphan students, courses, rooms, faculty, and enrollments.
- Unique course codes and room names prevent duplicate catalog and location records.
- Faculty name and department are unique together.
- Enrollment status is limited to `enrolled`, `waitlisted`, or `dropped`.
- A section must have `end_time > start_time`.
- A student cannot have the same section enrollment more than once.
- A student cannot actively enroll in the same course through multiple sections.
- A section cannot exceed the physical capacity of its room.

## 6. Prerequisite Graph and Recursive SQL

Prerequisites are stored as edges in the `prerequisites` table. For example:

```text
CS101 -> CS202 -> CS303
                 \
                  -> CS305
```

The enrollment trigger uses a recursive common table expression to find both direct and indirect prerequisites:

```sql
WITH RECURSIVE chain(course_id) AS (
  SELECT prereq_course_id
  FROM prerequisites
  WHERE course_id = target_course

  UNION

  SELECT p.prereq_course_id
  FROM prerequisites p
  JOIN chain c ON p.course_id = c.course_id
)
SELECT COUNT(*)
FROM chain c
WHERE NOT EXISTS (
  SELECT 1
  FROM completed_courses cc
  WHERE cc.student_id = NEW.student_id
    AND cc.course_id = c.course_id
);
```

This demonstrates a graph relationship implemented inside a relational DBMS without duplicating prerequisite paths in application code.

## 7. Database-Level Business Rules

### 7.1 Enrollment validation trigger

The `check_enrollment()` PostgreSQL trigger validates:

1. The student has completed every prerequisite in the recursive prerequisite chain.
2. The student does not have a timetable overlap with another active enrollment.
3. The student has not already enrolled in the same course.
4. The section has available capacity when the enrollment status is `enrolled`.

The database performs these checks even if a client bypasses the React interface. This is important because business rules should not exist only in frontend code.

### 7.2 Section assignment trigger

The `check_section_assignment()` trigger checks that:

- A faculty member is not assigned to overlapping sections in the same semester.
- A classroom is not assigned to overlapping sections in the same semester.
- The section capacity does not exceed the selected classroom capacity.

The frontend performs an early check for better user feedback, but PostgreSQL remains the final authority.

### 7.3 Waitlist and re-enrollment

When a section is full, the API creates an enrollment with status `waitlisted`. When an active enrollment is dropped, the API uses a PostgreSQL transaction and promotes the earliest eligible waitlisted enrollment. A dropped enrollment can later be reactivated when the student selects the same section again.

## 8. Transaction Processing

Dropping and waitlist promotion are handled in a transaction:

```text
BEGIN
  Mark the selected enrollment as dropped
  Find waitlisted students in enrollment order
  Try to promote an eligible student
  Commit
```

Savepoints are used while testing waitlist candidates. If one candidate cannot be promoted because of a prerequisite or timetable rule, the failed update is rolled back to the savepoint and the next candidate can be tested.

This preserves atomicity: the drop and any successful promotion are committed together.

## 9. Indexing and Query Design

The schema includes indexes that support common operations:

- Unique indexes for course codes, room names, student emails, and faculty identity.
- An index on `enrollments(student_id)` for timetable and enrollment lookup.
- Primary-key indexes for joins between all core relations.

The API uses parameterized SQL queries, for example:

```js
rows(
  'SELECT * FROM courses WHERE course_id = $1',
  [courseId]
);
```

Parameterized queries reduce SQL injection risk and allow PostgreSQL to handle values separately from SQL structure.

## 10. MongoDB Design

### 10.1 `course_search` collection

Course records are copied into MongoDB as flexible search documents. A text index is created over course title and description:

```js
await db.collection('course_search').createIndex({
  title: 'text',
  description: 'text'
});
```

MongoDB is suitable here because search documents can evolve independently from the normalized transactional schema. The relational database remains authoritative; MongoDB search data can be regenerated from PostgreSQL during seeding.

### 10.2 `audit_events` collection

Enrollment events are stored as append-oriented documents, for example:

```json
{
  "type": "enrollment.enrolled",
  "studentId": 3,
  "sectionId": 1,
  "createdAt": "2026-11-15T00:00:00.000Z"
}
```

Audit events do not participate in enrollment decisions. If MongoDB is unavailable, PostgreSQL enrollment still remains the source of truth.

### 10.3 SQL versus NoSQL responsibilities

| Requirement | Database | Reason |
|---|---|---|
| Enrollment validity | PostgreSQL | Requires transactions, joins, constraints, and triggers |
| Prerequisite graph | PostgreSQL | Relational integrity and recursive SQL |
| Timetable conflict detection | PostgreSQL | Consistent comparison of related records |
| Course text search | MongoDB | Flexible documents and text indexing |
| Enrollment audit history | MongoDB | Append-oriented event documents |

## 11. Seeded Demonstration Data

The seed script creates:

- Seven students with different subject choices.
- Courses including CS101, CS202, CS303, CS305, IS210, and CS110.
- Faculty members and classrooms.
- Prerequisite edges such as CS101 → CS202 and CS202 → CS303.
- Sections distributed across Monday to Friday.
- Completed courses and active enrollments for the student profiles.

The student portal allows the user to switch profiles. The selected student’s timetable and course status are loaded from PostgreSQL.

The Admin console displays the live number of enrolled students in every section and the names of those students.

## 12. API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/courses` | List and search courses with prerequisites |
| `GET /api/sections` | List sections, capacity, counts, and enrolled names |
| `GET /api/students` | List student profiles and completed courses |
| `GET /api/students/:id/schedule` | Get one student’s active timetable |
| `POST /api/students/:id/completed` | Add a completed course for the demo |
| `POST /api/enrollments` | Enroll or waitlist a student |
| `POST /api/enrollments/:id/drop` | Drop an enrollment and promote waitlist candidates |
| `GET /api/recommendations/:courseId` | Return related courses and recommendation reasons |
| `GET /api/faculty` | List faculty and teaching counts |
| `GET /api/rooms` | List classrooms and scheduled-section counts |

## 13. Functional Demonstration Scenarios

1. Select a student in the Student Portal.
2. Attempt to enroll in a course without its prerequisites.
3. Enroll in a valid course and observe the timetable update.
4. Attempt a timetable clash and observe database rejection.
5. Fill a section and place another student on the waitlist.
6. Drop an enrollment and observe waitlist promotion.
7. Re-enroll in the dropped section.
8. Open Admin and inspect section counts and enrolled student names.
9. Load a faculty or classroom clash and verify section creation is rejected.
10. Use the course filters and prerequisite visualization.

## 14. Normalization and Design Discussion

The core PostgreSQL design follows normalized relational principles:

- Student, faculty, course, room, and section attributes are stored in separate relations.
- Many-to-many relationships are represented through associative tables.
- Repeating course and student data is avoided in enrollment rows.
- Derived values such as enrolled count are calculated through queries instead of being manually duplicated.
- MongoDB intentionally contains denormalized copies for search and audit use cases.

This hybrid design combines relational consistency for academic transactions with document flexibility for search and event history.

## 15. Limitations and Future Improvements

- Authentication is currently represented by demo role selection rather than real user accounts.
- Authorization should be added so students cannot modify another student’s records.
- Capacity checks should use stronger locking or a database advisory-lock strategy for very high concurrent enrollment traffic.
- A dedicated semester relation and semester selector would improve multi-semester support.
- MongoDB search documents should be synchronized through an event queue or change-data-capture process in production.
- Automated integration tests should cover triggers, waitlist ordering, re-enrollment, and concurrent capacity updates.

## 16. Conclusion

CourseGraph demonstrates how a DBMS-centered academic system can combine PostgreSQL and MongoDB effectively. PostgreSQL provides normalized storage, foreign keys, recursive queries, triggers, transactions, and reliable enrollment decisions. MongoDB provides flexible search documents and audit-event storage. The project therefore illustrates both relational and NoSQL database concepts in one practical application while keeping the consistency-critical academic data inside PostgreSQL.
