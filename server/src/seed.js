import { sql, mongoDb } from './db.js';

await sql.query(`
  UPDATE sections SET semester='2026' WHERE semester='2026-FALL';
  UPDATE courses SET code='CS202' WHERE code='CS201';
  UPDATE courses SET code='CS303' WHERE code='CS301';
  DELETE FROM completed_courses WHERE student_id=(SELECT student_id FROM students WHERE email='student@coursegraph.test') AND course_id=(SELECT course_id FROM courses WHERE code='CS202');
  INSERT INTO students(name,email,batch_year) VALUES ('Demo Student','student@coursegraph.test',2024) ON CONFLICT (email) DO NOTHING;
  INSERT INTO students(name,email,batch_year) VALUES
    ('Asha Menon','asha@coursegraph.test',2024),
    ('Bharat Kumar','bharat@coursegraph.test',2024),
    ('Charan Das','charan@coursegraph.test',2025),
    ('Divya Shah','divya@coursegraph.test',2025),
    ('Esha Thomas','esha@coursegraph.test',2024),
    ('Farhan Ali','farhan@coursegraph.test',2025)
  ON CONFLICT (email) DO NOTHING;
  INSERT INTO faculty(name,dept) VALUES
    ('Dr. Ananya Rao','Computer Science'), ('Anupama Roy','Computer Science'), ('Dr. Meera Iyer','Information Systems'), ('Dr. Leela Nair','Computer Science'), ('Dr. Reshma', 'Computer Science')
  ON CONFLICT (name,dept) DO NOTHING;
  INSERT INTO rooms(name,capacity,building) VALUES
    ('A-101',60,'Block A'), ('A-202',45,'Block A'), ('B-105',40,'Block B'), ('C-201',50,'Block C')
  ON CONFLICT (name) DO NOTHING;
  INSERT INTO courses(code,title,description,credits,dept) VALUES
    ('CS101','Programming Fundamentals','Variables, algorithms, and problem solving',4,'Computer Science'),
    ('CS202','Data Structures','Graphs, trees, and algorithmic data structures',4,'Computer Science'),
    ('CS303','Database Systems','Relational and document database design',4,'Computer Science'),
    ('CS305','Web Application Engineering','Modern frontend, backend, and API architecture',3,'Computer Science'),
    ('IS210','Information Systems Design','Modeling business processes and information flows',3,'Information Systems'),
    ('CS110','Introduction to Cloud Computing','Cloud services, deployment, and scalable application basics',3,'Computer Science')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO prerequisites(course_id,prereq_course_id)
  SELECT c.course_id,p.course_id FROM courses c,courses p
  WHERE (c.code='CS202' AND p.code='CS101') OR (c.code='CS303' AND p.code IN ('CS101','CS202')) OR (c.code='CS305' AND p.code='CS202') OR (c.code='IS210' AND p.code='CS101') ON CONFLICT DO NOTHING;
  INSERT INTO completed_courses(student_id,course_id,grade,semester_completed)
  SELECT s.student_id,c.course_id,'A','2025-SPRING' FROM students s,courses c
  WHERE s.email='student@coursegraph.test' AND c.code='CS101' ON CONFLICT DO NOTHING;
  INSERT INTO sections(course_id,faculty_id,room_id,day_of_week,start_time,end_time,semester,capacity)
  SELECT c.course_id,f.faculty_id,r.room_id,x.day::varchar,x.start_time::time,x.end_time::time,'2026'::varchar,x.capacity::int
  FROM (VALUES
    ('CS202','Anupama Roy','A-101','MON','10:00','11:00',60),
    ('CS303','Dr. Ananya Rao','A-202','TUE','10:00','11:00',45),
    ('CS305','Dr. Ananya Rao','B-105','WED','14:00','15:00',40),
    ('IS210','Dr. Meera Iyer','A-101','THU','11:00','12:00',60),
    ('CS110','Dr. Leela Nair','C-201','FRI','10:00','11:00',40)
  ) AS x(code,faculty_name,room_name,day,start_time,end_time,capacity)
  JOIN courses c ON c.code=x.code JOIN faculty f ON f.name=x.faculty_name JOIN rooms r ON r.name=x.room_name
  WHERE NOT EXISTS (SELECT 1 FROM sections existing_section WHERE existing_section.course_id=c.course_id AND existing_section.semester='2026');
  INSERT INTO completed_courses(student_id,course_id,grade,semester_completed)
  SELECT s.student_id,c.course_id,'A','2025-SPRING' FROM students s CROSS JOIN courses c
  WHERE s.email IN ('student@coursegraph.test','asha@coursegraph.test','bharat@coursegraph.test','charan@coursegraph.test','divya@coursegraph.test','esha@coursegraph.test','farhan@coursegraph.test') AND c.code='CS101'
  ON CONFLICT DO NOTHING;
  INSERT INTO completed_courses(student_id,course_id,grade,semester_completed)
  SELECT s.student_id,c.course_id,'A','2025-FALL' FROM students s CROSS JOIN courses c
  WHERE s.email IN ('charan@coursegraph.test','divya@coursegraph.test') AND c.code='CS202'
  ON CONFLICT DO NOTHING;
  INSERT INTO enrollments(student_id,section_id,status_)
  SELECT s.student_id,sec.section_id,'enrolled' FROM (VALUES
    ('student@coursegraph.test','CS202'),('student@coursegraph.test','IS210'),
    ('asha@coursegraph.test','CS202'),('bharat@coursegraph.test','IS210'),('bharat@coursegraph.test','CS110'),
    ('charan@coursegraph.test','CS202'),('charan@coursegraph.test','CS110'),
    ('divya@coursegraph.test','CS303'),('esha@coursegraph.test','IS210'),('esha@coursegraph.test','CS110'),
    ('farhan@coursegraph.test','CS110')) choices(email,code)
  JOIN students s ON s.email=choices.email JOIN courses c ON c.code=choices.code JOIN sections sec ON sec.course_id=c.course_id AND sec.semester='2026'
  WHERE NOT EXISTS (SELECT 1 FROM enrollments existing_enrollment WHERE existing_enrollment.student_id=s.student_id AND existing_enrollment.section_id=sec.section_id)
  ON CONFLICT (student_id,section_id) DO NOTHING;
`);

try {
  const db = await mongoDb();
  const courses = (await sql.query('SELECT course_id,code,title,description,dept FROM courses')).rows;
  await db.collection('course_search').createIndex({ title: 'text', description: 'text' });
  await db.collection('course_search').deleteMany({});
  if (courses.length) await db.collection('course_search').insertMany(courses.map(c => ({ ...c, courseId: c.course_id })));
} catch (error) { console.warn('MongoDB seed skipped:', error.message); }

await sql.end();
console.log('Seed data inserted');
