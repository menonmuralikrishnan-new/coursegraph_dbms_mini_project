import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = 'http://localhost:4000/api';
const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

function Login({ onLogin }) {
  return <main className="login">
    <div className="eyebrow">ACADEMIC OPERATIONS / 2026</div>
    <h1>Course<span>Graph</span></h1>
    <p>Choose a demo role to explore the constraint-aware enrollment engine.</p>
    <div className="role-grid">
      <button onClick={() => onLogin('student')}><b>Student portal</b><small>Search courses, see prerequisites, enroll, and view your timetable.</small></button>
      <button onClick={() => onLogin('admin')}><b>Admin portal</b><small>Create or edit sections and validate faculty and classroom conflicts.</small></button>
    </div>
  </main>;
}

function App() {
  const [role, setRole] = useState(null);
  return role ? <Dashboard role={role} logout={() => setRole(null)} /> : <Login onLogin={setRole} />;
}

function Dashboard({ role, logout }) {
  const [courses, setCourses] = useState([]), [sections, setSections] = useState([]), [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState(1), [completed, setCompleted] = useState([]);
  const [schedule, setSchedule] = useState([]), [faculty, setFaculty] = useState([]), [rooms, setRooms] = useState([]);
  const [suggestions, setSuggestions] = useState([]), [relatedCourseId, setRelatedCourseId] = useState(null), [message, setMessage] = useState('');
  const [search, setSearch] = useState(''), [department, setDepartment] = useState('All'), [credits, setCredits] = useState('All'), [instructor, setInstructor] = useState('All'), [day, setDay] = useState('All'), [startAfter, setStartAfter] = useState('All'), [openOnly, setOpenOnly] = useState(false), [tab, setTab] = useState(role === 'admin' ? 'admin' : 'catalog');
  const [editingSection, setEditingSection] = useState(null);
  const [form, setForm] = useState({ courseId: '', facultyId: '', roomId: '', dayOfWeek: 'MON', startTime: '10:00', endTime: '11:00', capacity: 40 });

  const load = () => {
    fetch(`${API}/courses`).then(r => r.json()).then(setCourses);
    fetch(`${API}/sections`).then(r => r.json()).then(setSections);
    fetch(`${API}/students`).then(r => r.json()).then(list => { setStudents(list); const selected=list.find(s => s.student_id === studentId) || list[0]; if (selected) { setStudentId(selected.student_id); setCompleted(selected.completed || []); fetch(`${API}/students/${selected.student_id}/schedule`).then(r => r.json()).then(setSchedule); } });
    fetch(`${API}/faculty`).then(r => r.json()).then(setFaculty);
    fetch(`${API}/rooms`).then(r => r.json()).then(setRooms);
  };
  const changeStudent = id => { const selected=students.find(s => String(s.student_id) === String(id)); if (!selected) return; setStudentId(selected.student_id); setCompleted(selected.completed || []); fetch(`${API}/students/${selected.student_id}/schedule`).then(r => r.json()).then(setSchedule); setMessage(`Viewing ${selected.name}'s courses and timetable.`); };
  useEffect(load, []);
  useEffect(() => {
    if (!form.courseId && courses[0] && faculty[0] && rooms[0]) {
      setForm(f => ({ ...f, courseId: courses[0].course_id, facultyId: faculty[0].faculty_id, roomId: rooms[0].room_id }));
    }
  }, [courses, faculty, rooms]);

  const enroll = async id => {
    const r = await fetch(`${API}/enrollments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, sectionId: id }) });
    const d = await r.json();
    const section = sections.find(s => s.section_id === id);
    if (r.ok) setMessage(`Enrolled in ${section?.code || 'section'} — timetable updated`);
    else {
      const reason = d.error === 'Missing prerequisite courses' ? 'a prerequisite is not completed' : d.error === 'Timetable conflict' ? 'it conflicts with your timetable' : d.error === 'Section is full' ? 'the section is full' : (d.error || 'the enrollment could not be completed');
      setMessage(`Could not enroll in ${section?.code || 'section'}: ${reason}.`);
    }
    if (r.ok) load();
  };
  const complete = async courseId => { await fetch(`${API}/students/${studentId}/completed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId }) }); setMessage('Course marked completed for the demo student. The next prerequisite can now be attempted.'); load(); };
  const drop = async enrollmentId => { const r = await fetch(`${API}/enrollments/${enrollmentId}/drop`, { method: 'POST' }); setMessage(r.ok ? 'Enrollment dropped.' : 'Could not drop this enrollment.'); if (r.ok) load(); };
  const recommend = async id => {
    const d = await (await fetch(`${API}/recommendations/${id}`)).json(); setSuggestions(d); setRelatedCourseId(id); setMessage('Related courses are shown inside the selected course card.');
  };
  const saveSection = async () => {
    if (form.startTime >= form.endTime) { setMessage('Could not save section: the end time must be after the start time.'); return; }
    const clash = sections.find(s => s.section_id !== editingSection?.section_id && String(s.faculty_id) === String(form.facultyId) && s.day_of_week === form.dayOfWeek && s.start_time.slice(0, 5) < form.endTime && s.end_time.slice(0, 5) > form.startTime);
    const roomClash = sections.find(s => s.section_id !== editingSection?.section_id && String(s.room_id) === String(form.roomId) && s.day_of_week === form.dayOfWeek && s.start_time.slice(0, 5) < form.endTime && s.end_time.slice(0, 5) > form.startTime);
    if (clash || roomClash) { setMessage(clash && roomClash ? 'Could not save section: the faculty member and classroom are both already booked.' : clash ? 'Could not save section: this faculty member is already teaching during this time.' : 'Could not save section: this classroom is already occupied during this time.'); return; }
    const url = editingSection ? `${API}/sections/${editingSection.section_id}` : `${API}/sections`;
    const r = await fetch(url, { method: editingSection ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    setMessage(r.ok ? (editingSection ? 'Section updated successfully.' : 'Section created successfully.') : `Could not save section: ${d.error || 'unknown error'}.`);
    if (r.ok) { setEditingSection(null); load(); }
  };
  const editSection = s => {
    setEditingSection(s);
    setForm({ courseId: s.course_id, facultyId: s.faculty_id, roomId: s.room_id, dayOfWeek: s.day_of_week, startTime: s.start_time.slice(0, 5), endTime: s.end_time.slice(0, 5), capacity: s.capacity });
    setMessage(`Editing ${s.code}. Change the fields, then click Save changes.`);
  };
  const demo = kind => {
    const s = sections[0]; if (!s) return;
    setForm({ ...form, facultyId: kind === 'faculty' ? s.faculty_id : (faculty.find(f => f.faculty_id !== s.faculty_id)?.faculty_id || s.faculty_id), roomId: kind === 'room' ? s.room_id : (rooms.find(r => r.room_id !== s.room_id)?.room_id || s.room_id), dayOfWeek: s.day_of_week, startTime: s.start_time.slice(0, 5), endTime: s.end_time.slice(0, 5), courseId: courses.find(c => c.course_id !== s.course_id)?.course_id || s.course_id });
    setMessage(`Demo loaded: ${kind === 'faculty' ? 'same faculty' : 'same classroom'} and overlapping time. Click Create section.`);
  };

  const departments = [...new Set(courses.map(c => c.dept))];
  const instructors = [...new Set(sections.map(s => s.faculty))];
  const sectionFiltersActive = day !== 'All' || instructor !== 'All' || startAfter !== 'All' || openOnly;
  const matchingSections = sections.filter(s => (day === 'All' || s.day_of_week === day) && (instructor === 'All' || s.faculty === instructor) && (startAfter === 'All' || s.start_time.slice(0, 5) >= startAfter) && (!openOnly || Number(s.enrolled) < Number(s.capacity)));
  const matchingCourseIds = new Set(matchingSections.map(s => s.course_id));
  const filter = courses.filter(c => (c.code + ' ' + c.title).toLowerCase().includes(search.toLowerCase()) && (department === 'All' || c.dept === department) && (credits === 'All' || String(c.credits) === credits) && (!sectionFiltersActive || matchingCourseIds.has(c.course_id)));
  const visibleCourseIds = new Set(filter.map(c => c.course_id));
  const filteredSections = matchingSections.filter(s => visibleCourseIds.has(s.course_id));
  return <main>
    <header><div><div className="eyebrow">ACADEMIC OPERATIONS / 2026</div><h1>Course<span>Graph</span></h1><p>{role === 'admin' ? 'Administrator console' : 'Student enrollment portal'}</p></div>
      <nav>{role === 'student' && <><button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Catalog</button><button className={tab === 'schedule' ? 'active' : ''} onClick={() => setTab('schedule')}>My timetable</button></>}{role === 'admin' && <button className="active" onClick={() => setTab('admin')}>Admin console</button>}<button onClick={logout}>Log out</button></nav>
    </header>
    {message && <div className="notice toast" role="status" style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 20, maxWidth: 380, boxShadow: '0 10px 30px rgba(23,35,31,.22)' }}>{message}</div>}
    {role === 'student' && tab === 'catalog' && <StudentCatalog students={students} studentId={studentId} changeStudent={changeStudent} courses={filter} sections={filteredSections} schedule={schedule} completed={completed} suggestions={suggestions} relatedCourseId={relatedCourseId} search={search} setSearch={setSearch} departments={departments} department={department} setDepartment={setDepartment} credits={credits} setCredits={setCredits} instructors={instructors} instructor={instructor} setInstructor={setInstructor} day={day} setDay={setDay} startAfter={startAfter} setStartAfter={setStartAfter} openOnly={openOnly} setOpenOnly={setOpenOnly} recommend={recommend} enroll={enroll} complete={complete} drop={drop} />}
    {role === 'student' && tab === 'schedule' && <StudentSchedule schedule={schedule} drop={drop} studentName={students.find(s => s.student_id === studentId)?.name || 'Student'} />}
    {role === 'admin' && <AdminFixed sections={sections} courses={courses} faculty={faculty} rooms={rooms} form={form} setForm={setForm} saveSection={saveSection} editSection={editSection} editingSection={editingSection} cancelEdit={() => setEditingSection(null)} demo={demo} />}
  </main>;
}

function StudentCatalog({ students, studentId, changeStudent, courses, sections, schedule, completed, suggestions, relatedCourseId, search, setSearch, departments, department, setDepartment, credits, setCredits, instructors, instructor, setInstructor, day, setDay, startAfter, setStartAfter, openOnly, setOpenOnly, recommend, enroll, complete }) {
  return <>
    <section className="hero"><div><div className="eyebrow">STUDENT PORTAL · SELECT A PROFILE</div><h2>Start your<br />Journey.</h2><p>Each demo student has an independent set of completed courses and enrollments.</p><label className="student-picker">Student<select value={studentId} onChange={e => changeStudent(e.target.value)}>{students.map(s => <option key={s.student_id} value={s.student_id}>{s.name}</option>)}</select></label></div><div className="metric"><b>{courses.length}</b><small>COURSES</small></div></section>
    <section className="toolbar"><h2>Course catalog</h2><input placeholder="Search code or title" value={search} onChange={e => setSearch(e.target.value)} /></section>
    <div className="filters"><select value={department} onChange={e => setDepartment(e.target.value)}><option value="All">All departments</option>{departments.map(d => <option key={d}>{d}</option>)}</select><select value={credits} onChange={e => setCredits(e.target.value)}><option value="All">All credits</option><option value="3">3 credits</option><option value="4">4 credits</option></select><select value={instructor} onChange={e => setInstructor(e.target.value)}><option value="All">All instructors</option>{instructors.map(f => <option key={f}>{f}</option>)}</select><select value={day} onChange={e => setDay(e.target.value)}><option value="All">All days</option>{days.map(d => <option key={d}>{d}</option>)}</select><select value={startAfter} onChange={e => setStartAfter(e.target.value)}><option value="All">Any time</option><option value="10:00">From 10:00</option><option value="14:00">From 14:00</option></select><label><input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} /> Open seats only</label></div>
    <section className="grid">{courses.map(c => { const done=completed.some(x => x.code === c.code); const enrolled=schedule.some(x => x.code === c.code); return <article className="card" key={c.course_id}><div className="code">{c.code} · {c.credits} CREDITS</div><h3>{c.title}</h3><p>{c.description}</p><div className="tags">{c.dept}{c.prerequisites?.map(p => <span key={p.code}>Requires {p.code}</span>)}</div>{c.prerequisites?.length > 0 && <div className="course-graph"><b>Prerequisite path</b><span>{c.prerequisites.map(p => p.code).join(' + ')} → {c.code}</span></div>}{done && <div className="status">✓ Completed</div>}{enrolled && <div className="status enrolled">✓ Enrolled successfully</div>}{!done && !enrolled && <button className="link" onClick={() => complete(c.course_id)}>Mark completed for demo →</button>}<button className="link" onClick={() => recommend(c.course_id)}>Show similar courses →</button>{relatedCourseId === c.course_id && suggestions.length > 0 && <div className="inline-suggestions"><b>Similar courses</b>{suggestions.slice(0, 3).map(s => <span key={s.course_id}>{s.code} — {s.title}<small>{s.reason || 'Related by course profile'}</small></span>)}</div>}</article>})}</section>
    <section className="toolbar"><h2>Open sections</h2><span className="muted">Academic Year 2026</span></section>
    <section className="sections">{sections.map(s => { const isEnrolled=schedule.some(item => item.code === s.code); return <div className="section" key={s.section_id}><div><b>{s.code}</b><span>{s.title}</span></div><div>{s.day_of_week} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.room}<small>{s.faculty} · {s.enrolled}/{s.capacity} seats</small></div><button disabled={isEnrolled} onClick={() => enroll(s.section_id)}>{isEnrolled ? 'Enrolled' : Number(s.enrolled) >= Number(s.capacity) ? 'Join waitlist' : 'Enroll'}</button></div>})}</section>
  </>;
}

function StudentSchedule({ schedule, drop, studentName }) {
  return <section className="panel"><div className="toolbar"><h2>My timetable</h2><span className="muted">{studentName} · Academic Year 2026</span></div><div className="week">{days.map(day => <div key={day}><b>{day}</b>{schedule.filter(s => s.day_of_week === day).map(s => <article key={s.enrollment_id}><strong>{s.code}</strong><span>{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span><small>{s.room}</small><button onClick={() => drop(s.enrollment_id)}>Drop</button></article>)}</div>)}</div></section>;
}

function AdminFixed({ sections, courses, faculty, rooms, form, setForm, saveSection, editSection, editingSection, cancelEdit, demo }) {
  const field = (key, label, children) => <label>{label}<select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>{children}</select></label>;
  return <section className="admin">
    <div className="hero"><div><div className="eyebrow">ADMINISTRATOR CONSOLE</div><h2>Make scheduling<br />rules visible.</h2><p>Create or edit a class. PostgreSQL rejects overlapping faculty and classroom assignments.</p></div></div>
    <div className="admin-grid">
      <div className="panel"><h2>{editingSection ? `Edit ${editingSection.code}` : 'Create a section'}</h2><p className="muted">Use the demo buttons to show each constraint.</p>
        {field('courseId', 'Course', courses.map(c => <option key={c.course_id} value={c.course_id}>{c.code} — {c.title}</option>))}
        {field('facultyId', 'Faculty', faculty.map(f => <option key={f.faculty_id} value={f.faculty_id}>{f.name}</option>))}
        {field('roomId', 'Classroom', rooms.map(r => <option key={r.room_id} value={r.room_id}>{r.name} — {r.building}</option>))}
        {field('dayOfWeek', 'Day', days.map(d => <option key={d}>{d}</option>))}
        <div className="time-row"><label>Starts<input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></label><label>Ends<input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></label></div>
        <button onClick={() => demo('faculty')}>Load faculty clash</button><button onClick={() => demo('room')}>Load classroom clash</button>
        <button className="primary" onClick={saveSection}>{editingSection ? 'Save changes' : 'Create section'}</button>{editingSection && <button onClick={cancelEdit}>Cancel edit</button>}
      </div>
      <div className="panel"><h2>Existing sections</h2>{sections.map(s => <div className="admin-section" key={s.section_id}><b>{s.code} · {s.day_of_week} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</b><span>{s.faculty} · {s.room} · {s.enrolled}/{s.capacity} enrolled</span><small>{s.enrolled_students?.length ? `Students: ${s.enrolled_students.map(x => x.name).join(', ')}` : 'No students enrolled'}</small><button onClick={() => editSection(s)}>Edit this section</button></div>)}</div>
    </div>
    <div className="panel faculty-panel"><h2>Faculty details & teaching timetable</h2>{faculty.map(f => <div className="faculty-row" key={f.faculty_id}><b>{f.name}</b><span>{f.dept}</span><small>{sections.filter(s => s.faculty_id === f.faculty_id).map(s => `${s.code}: ${s.day_of_week} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} in ${s.room}`).join(' · ') || 'No classes assigned'}</small></div>)}</div>
    <div className="panel faculty-panel"><h2>Classroom utilization</h2>{rooms.map(r => <div className="faculty-row" key={r.room_id}><b>{r.name} · {r.building}</b><span>{r.scheduled_sections} scheduled sections · capacity {r.capacity}</span><small>{sections.filter(s => s.room_id === r.room_id).map(s => `${s.code}: ${s.day_of_week} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`).join(' · ') || 'No classes scheduled'}</small></div>)}</div>
  </section>;
}

createRoot(document.getElementById('root')).render(<App />);
