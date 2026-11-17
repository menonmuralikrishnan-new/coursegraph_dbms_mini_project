CREATE TABLE IF NOT EXISTS students (student_id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, batch_year INT NOT NULL CHECK (batch_year >= 2000));
CREATE TABLE IF NOT EXISTS faculty (faculty_id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, dept VARCHAR(50) NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS faculty_name_dept_unique ON faculty(name, dept);
CREATE TABLE IF NOT EXISTS courses (course_id SERIAL PRIMARY KEY, code VARCHAR(20) UNIQUE NOT NULL, title VARCHAR(150) NOT NULL, description TEXT NOT NULL DEFAULT '', credits INT NOT NULL CHECK (credits > 0), dept VARCHAR(50) NOT NULL);
CREATE TABLE IF NOT EXISTS prerequisites (course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE, prereq_course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE, PRIMARY KEY (course_id, prereq_course_id), CHECK (course_id <> prereq_course_id));
CREATE TABLE IF NOT EXISTS rooms (room_id SERIAL PRIMARY KEY, name VARCHAR(80) UNIQUE NOT NULL, capacity INT NOT NULL CHECK (capacity > 0), building VARCHAR(50) NOT NULL);
CREATE TABLE IF NOT EXISTS sections (section_id SERIAL PRIMARY KEY, course_id INT NOT NULL REFERENCES courses(course_id), faculty_id INT NOT NULL REFERENCES faculty(faculty_id), room_id INT NOT NULL REFERENCES rooms(room_id), day_of_week VARCHAR(10) NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, semester VARCHAR(20) NOT NULL, capacity INT NOT NULL CHECK (capacity > 0), CHECK (end_time > start_time));
CREATE TABLE IF NOT EXISTS enrollments (enrollment_id SERIAL PRIMARY KEY, student_id INT NOT NULL REFERENCES students(student_id), section_id INT NOT NULL REFERENCES sections(section_id), status_ VARCHAR(20) NOT NULL DEFAULT 'enrolled' CHECK (status_ IN ('enrolled','waitlisted','dropped')), enrolled_at TIMESTAMP NOT NULL DEFAULT NOW(), waitlist_priority INT NOT NULL DEFAULT 0, UNIQUE (student_id, section_id));
CREATE TABLE IF NOT EXISTS completed_courses (student_id INT NOT NULL REFERENCES students(student_id), course_id INT NOT NULL REFERENCES courses(course_id), grade VARCHAR(2) NOT NULL, semester_completed VARCHAR(20) NOT NULL, PRIMARY KEY (student_id, course_id));
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE OR REPLACE FUNCTION check_enrollment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target_course INT; missing_count INT; conflict_count INT; seats INT;
BEGIN
  SELECT course_id INTO target_course FROM sections WHERE section_id = NEW.section_id;
  IF EXISTS (
    SELECT 1 FROM enrollments e JOIN sections existing_section ON existing_section.section_id=e.section_id
    WHERE e.student_id=NEW.student_id AND e.status_='enrolled'
      AND existing_section.course_id=target_course
      AND e.enrollment_id <> COALESCE(NEW.enrollment_id, 0)
  ) THEN RAISE EXCEPTION 'Already enrolled in this course'; END IF;
  IF NEW.status_ <> 'enrolled' THEN RETURN NEW; END IF;
  WITH RECURSIVE chain(course_id) AS (SELECT prereq_course_id FROM prerequisites WHERE course_id = target_course UNION SELECT p.prereq_course_id FROM prerequisites p JOIN chain c ON p.course_id=c.course_id)
  SELECT COUNT(*) INTO missing_count FROM chain c WHERE NOT EXISTS (SELECT 1 FROM completed_courses cc WHERE cc.student_id=NEW.student_id AND cc.course_id=c.course_id);
  IF missing_count > 0 THEN RAISE EXCEPTION 'Missing prerequisite courses'; END IF;
  SELECT COUNT(*) INTO conflict_count FROM enrollments e JOIN sections existing_section ON existing_section.section_id=e.section_id JOIN sections wanted ON wanted.section_id=NEW.section_id WHERE e.student_id=NEW.student_id AND e.status_='enrolled' AND existing_section.day_of_week=wanted.day_of_week AND existing_section.start_time < wanted.end_time AND existing_section.end_time > wanted.start_time;
  IF conflict_count > 0 THEN RAISE EXCEPTION 'Timetable conflict'; END IF;
  SELECT COUNT(*) INTO seats FROM enrollments WHERE section_id=NEW.section_id AND status_='enrolled';
  IF seats >= (SELECT capacity FROM sections WHERE section_id=NEW.section_id) THEN RAISE EXCEPTION 'Section is full'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_check_enrollment ON enrollments;
CREATE TRIGGER trg_check_enrollment BEFORE INSERT OR UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION check_enrollment();

-- Prevent faculty and classroom double-booking when sections are created or edited.
CREATE OR REPLACE FUNCTION check_section_assignment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.course_id = OLD.course_id
     AND NEW.faculty_id = OLD.faculty_id
     AND NEW.room_id = OLD.room_id
     AND NEW.day_of_week = OLD.day_of_week
     AND NEW.start_time = OLD.start_time
     AND NEW.end_time = OLD.end_time
     AND NEW.capacity = OLD.capacity THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM sections s
    WHERE s.section_id <> COALESCE(NEW.section_id, 0)
      AND s.semester = NEW.semester
      AND s.day_of_week = NEW.day_of_week
      AND s.start_time < NEW.end_time AND s.end_time > NEW.start_time
      AND (s.faculty_id = NEW.faculty_id OR s.room_id = NEW.room_id)
  ) THEN
    RAISE EXCEPTION 'Faculty or classroom is already booked for this time';
  END IF;
  IF NEW.capacity > (SELECT capacity FROM rooms WHERE room_id=NEW.room_id) THEN
    RAISE EXCEPTION 'Section capacity exceeds classroom capacity';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_check_section_assignment ON sections;
CREATE TRIGGER trg_check_section_assignment BEFORE INSERT OR UPDATE ON sections FOR EACH ROW EXECUTE FUNCTION check_section_assignment();
