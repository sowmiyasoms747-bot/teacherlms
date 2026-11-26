import type { Chapter, ClassRoom, DB, Mark, MaterialType, Question, Student, Subject, Submission } from './types'
import { addDays, lastSchoolDays, today } from './dates'

/** Sample data. Deterministic, so every fresh start looks the same. */
function rng(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
}

const CLASSES: ClassRoom[] = [
  { id: '12-a', name: 'Class 12 - A', subject: 'Physics', room: 'Room 204', icon: 'atom', hue: 1 },
  { id: '12-b', name: 'Class 12 - B', subject: 'Physics', room: 'Room 206', icon: 'flask', hue: 2 },
  { id: '11-a', name: 'Class 11 - A', subject: 'Physics', room: 'Physics Lab', icon: 'microscope', hue: 3 },
  { id: '11-b', name: 'Class 11 - B', subject: 'Physics', room: 'Room 112', icon: 'dna', hue: 4 },
]
const SIZE: Record<string, number> = { '12-a': 32, '12-b': 31, '11-a': 28, '11-b': 20 }
const FIRST = ['Aadhya', 'Akash', 'Anitha', 'Arjun', 'Bhavana', 'Charan', 'Deepa', 'Dinesh', 'Divya', 'Elango', 'Farhan', 'Gayathri', 'Gokul', 'Harini', 'Hemanth', 'Ishaan', 'Janani', 'Jeevan', 'Kavin', 'Kavya', 'Keerthi', 'Lakshmi', 'Madhan', 'Meera', 'Mithun', 'Naveen', 'Nila', 'Nithya', 'Pooja', 'Pranav', 'Priya', 'Ragul', 'Ramya', 'Rohit', 'Sahana', 'Sanjay', 'Sara', 'Shreya', 'Surya', 'Swathi', 'Tanvi', 'Tharun', 'Varsha', 'Vignesh', 'Vishal', 'Yamini', 'Yusuf', 'Zoya']
const LAST = 'SMRKPVTJBN'.split('')
export const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Maths', 'Biology', 'English']

export function newStudent(classId: string, roll: number, name: string, id = `${classId}-${roll}`): Student {
  return { id, roll, name, classId, guardian: `Parent of ${name.split(' ')[0]}`, phone: '', tests: [], subjects: { Physics: 0, Chemistry: 0, Maths: 0, Biology: 0, English: 0 } }
}

function makeStudents(): Student[] {
  const r = rng(41)
  const out: Student[] = []
  const clamp = (n: number) => Math.max(22, Math.min(98, Math.round(n)))
  let pick = 0
  for (const c of CLASSES) {
    const size = SIZE[c.id]
    const names = Array.from({ length: size }, () => { const i = pick++; return `${FIRST[(i * 7) % FIRST.length]} ${LAST[(i + Math.floor(i / 48) * 3) % LAST.length]}` }).sort()
    names.forEach((name, i) => {
      const spread = ((i * 13 + 5) % size) / size
      const base = spread < 0.6 ? 78 + r() * 17 : spread < 0.85 ? 56 + r() * 15 : 36 + r() * 11
      const tests = Array.from({ length: 5 }, (_, t) => clamp(base - (4 - t) * (r() * 3 - 0.8) + (t === 4 ? 0 : r() * 8 - 4)))
      out.push({
        ...newStudent(c.id, i + 1, name),
        phone: `+91 00000 ${10000 + out.length * 37}`,
        tests,
        subjects: { Physics: tests[4], Chemistry: clamp(base - 5 + r() * 8), Maths: clamp(base + 1 + r() * 8), Biology: clamp(base - 8 + r() * 8), English: clamp(base + 3 + r() * 8) },
      })
    })
  }
  return out
}

function makeAttendance(students: Student[]) {
  const r = rng(7)
  const out: Record<string, Record<string, Mark>> = {}
  for (const c of CLASSES) {
    const list = students.filter(s => s.classId === c.id)
    for (const d of lastSchoolDays(11)) {
      if (d === today()) continue
      out[`${c.id}:${d}`] = Object.fromEntries(list.map(s => {
        const x = r(), weak = s.tests[4] < 50 ? 0.14 : 0.035
        return [s.id, x < weak ? 'A' : x < weak + 0.03 ? 'L' : 'P'] as const
      }))
    }
  }
  out[`12-a:${today()}`] = Object.fromEntries(students.filter(s => s.classId === '12-a').map(s => [s.id, s.roll === 9 || s.roll === 24 ? 'A' : 'P'] as const))
  return out
}

function submissions(students: Student[], classId: string, count: number, graded: number, max: number, seedNo: number): Submission[] {
  const r = rng(seedNo)
  return students.filter(s => s.classId === classId).slice(0, count).map((s, i) => ({
    studentId: s.id, at: i % 3 ? 'Yesterday, 7:45 PM' : 'Today, 8:10 AM',
    mark: i < graded ? Math.min(max, Math.max(1, Math.round((s.tests[4] / 100) * max + r() * 2 - 1))) : null,
  }))
}

/** Numerical questions with worked-out answers, so quizzes hold real content. */
const rotate = (values: number[], unit: string, shift: number) => ({ options: values.map((_, j) => `${values[(j + shift) % 4]} ${unit}`), answer: (4 - shift) % 4 })
function coulomb(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => {
    const q1 = (i % 8) + 2, q2 = (Math.floor(i / 8) % 5) + 3
    const f = 0.9 * q1 * q2
    return { text: `Two point charges of ${q1} µC and ${q2} µC are 10 cm apart in vacuum. What is the force between them? (k = 9 × 10⁹ N m² C⁻²)`, ...rotate([f, f * 2, f / 2, f * 4].map(x => +x.toFixed(2)), 'N', i % 4) }
  })
}
function kinematics(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => {
    const u = 2 + i, a = 2 + (i % 4), t = 3 + (i % 5), v = u + a * t
    return { text: `A body starts at ${u} m/s and accelerates uniformly at ${a} m/s². What is its speed after ${t} s?`, ...rotate([v, v + a, v - a, v + 3 * a], 'm/s', (i + 1) % 4) }
  })
}
const CONCEPT: Question[] = [
  { text: 'The SI unit of electric charge is the', options: ['coulomb', 'ampere', 'volt', 'farad'], answer: 0 },
  { text: 'Electric field lines of an isolated dipole point', options: ['from negative to positive charge', 'from positive to negative charge', 'in closed loops', 'perpendicular to the force'], answer: 1 },
  { text: 'If the distance between two point charges is doubled, the force between them becomes', options: ['double', 'half', 'one quarter', 'four times'], answer: 2 },
  { text: 'The net electric flux through a closed surface depends on', options: ['its shape', 'its size', 'the charge outside it', 'the charge enclosed by it'], answer: 3 },
]

const ch = (title: string, periods: number, state: Chapter['state'] = 'todo'): Chapter => ({ title, periods, state })
const XII = () => [ch('Electric Charges and Fields', 14, 'doing'), ch('Electrostatic Potential and Capacitance', 12), ch('Current Electricity', 14), ch('Moving Charges and Magnetism', 14), ch('Magnetism and Matter', 8), ch('Electromagnetic Induction', 10), ch('Alternating Current', 10), ch('Electromagnetic Waves', 4), ch('Ray Optics and Optical Instruments', 16), ch('Wave Optics', 10)]
const XI = (n: number) => ['Units and Measurement', 'Motion in a Straight Line', 'Motion in a Plane', 'Laws of Motion', 'Work, Energy and Power', 'System of Particles and Rotational Motion', 'Gravitation', 'Mechanical Properties of Solids', 'Thermodynamics', 'Oscillations'].map((t, i) => ch(t, 8 + (i * 3) % 7, i < n ? 'done' : i === n ? 'doing' : 'todo'))

export function seed(): DB {
  const students = makeStudents()
  const t = today()
  const m = (id: string, title: string, classId: string, type: MaterialType, size: string, days: number, description: string, file: string, visible = true) =>
    ({ id, title, classId, subject: 'Physics', type, size, file, description, visible, date: addDays(t, -days) })
  return {
    classes: structuredClone(CLASSES), students,
    materials: [
      m('m1', 'Electric Fields', '12-a', 'Slides', '8.4 MB', 1, 'Field lines, superposition and the field of a dipole.', 'Electric_Fields.pptx'),
      m('m2', 'Electric Charges - Interactive Module', '12-a', 'SCORM', '42.8 MB', 2, 'Interactive module with theory, animation and practice.', 'Electric_Charges_SCORM.zip'),
      m('m3', 'Coulomb’s Law worked examples', '12-a', 'PDF', '1.2 MB', 3, 'Twelve solved numericals, from two charges to a square of four.', 'Coulomb_examples.pdf'),
      m('m4', 'Gauss’s Law derivation', '12-a', 'Video', '64 MB', 6, 'Lecture recording, 18 minutes.', 'Gauss_law.mp4'),
      m('m5', 'Chapter 1 formula sheet', '12-a', 'PDF', '320 KB', 8, 'One page for revision.', 'Ch1_formulae.pdf', false),
      m('m6', 'Electrostatics lab manual', '12-b', 'PDF', '2.6 MB', 4, 'Procedures and observation tables for practicals.', 'Electrostatics_lab.pdf'),
      m('m7', 'Electric Charges - Interactive Module', '12-b', 'SCORM', '42.8 MB', 2, 'Interactive module with theory, animation and practice.', 'Electric_Charges_SCORM.zip'),
      m('m8', 'Charging by induction demo', '12-b', 'Video', '28 MB', 9, 'Gold-leaf electroscope demonstration.', 'Induction_demo.mp4'),
      m('m9', 'Unit 1 worksheet', '11-a', 'PDF', '540 KB', 5, 'Dimensional analysis and significant figures.', 'Unit1_worksheet.pdf'),
      m('m10', 'Motion graphs', '11-a', 'Slides', '5.1 MB', 7, 'Reading x-t, v-t and a-t graphs.', 'Motion_graphs.pptx'),
      m('m11', 'Vernier calliper simulator', '11-b', 'Link', 'Link', 3, 'Practise readings before the lab session.', 'https://example.com/vernier'),
      m('m12', 'Free-body diagrams', '11-b', 'Slides', '3.8 MB', 11, 'Step by step with ramps and pulleys.', 'Free_body.pptx', false),
    ],
    assignments: [
      { id: 'a1', title: 'Chapter 1 - Electric Charges', classId: '12-a', opens: addDays(t, -6), due: t, maxMark: 20, instructions: 'Solve exercises 1.1 to 1.8. Show every step and box the final answer.', submissions: submissions(students, '12-a', 26, 21, 20, 3) },
      { id: 'a2', title: 'Homework - Coulomb’s Law', classId: '12-b', opens: addDays(t, -3), due: t, maxMark: 10, instructions: 'Five numericals from the handout. Draw a diagram for each.', submissions: submissions(students, '12-b', 14, 11, 10, 5) },
      { id: 'a3', title: 'Worksheet - Unit 1', classId: '11-a', opens: addDays(t, 1), due: addDays(t, 4), maxMark: 15, instructions: 'Dimensional analysis worksheet. Submit as a scan or photo.', submissions: [] },
      { id: 'a4', title: 'Lab record - Vernier calliper', classId: '11-b', opens: addDays(t, -14), due: addDays(t, -6), maxMark: 10, instructions: 'Complete the observation table and error calculation.', submissions: submissions(students, '11-b', 19, 19, 10, 9) },
      { id: 'a5', title: 'Conservation of charge - short notes', classId: '12-a', opens: addDays(t, -18), due: addDays(t, -10), maxMark: 10, instructions: 'One page in your own words.', submissions: submissions(students, '12-a', 31, 31, 10, 11) },
    ],
    quizzes: [
      { id: 'q1', title: 'Chapter 01 - Quick Quiz', classId: '12-a', minutes: 15, planned: 10, questions: [...CONCEPT, ...coulomb(6)], published: true, attempts: 29, average: 74 },
      { id: 'q2', title: 'Mid-Chapter Test', classId: '12-b', minutes: 45, planned: 25, questions: [...CONCEPT, ...coulomb(21)], published: true, attempts: 18, average: 66 },
      { id: 'q3', title: 'Unit Test - Physics', classId: '11-a', minutes: 90, planned: 50, questions: kinematics(12), published: false, attempts: 0, average: null },
    ],
    attendance: makeAttendance(students),
    timetable: ([
      [1, '09:00', '10:00', '12-b'], [1, '11:30', '12:30', '11-b'], [1, '13:00', '14:00', '12-a'],
      [2, '09:00', '10:00', '11-a'], [2, '10:15', '11:15', '12-a'], [2, '14:15', '15:15', '11-b'],
      [3, '09:00', '10:00', '12-a'], [3, '11:30', '12:30', '12-b'], [3, '13:00', '14:00', '11-b'],
      [4, '09:00', '10:00', '12-a'], [4, '10:15', '11:15', '12-b'], [4, '13:00', '14:00', '11-a'],
      [5, '10:15', '11:15', '11-a'], [5, '11:30', '12:30', '12-b'], [5, '13:00', '14:00', '11-b'],
    ] as [number, string, string, string][]).map(([day, start, end, classId]) => ({ day, start, end, classId })),
    syllabus: { '12-a': XII(), '12-b': XII(), '11-a': XI(1), '11-b': XI(3) },
    threads: [
      { id: 't1', name: 'Parent of Kavya', about: 'Class 12 - B', unread: true, messages: [{ from: 'them', text: 'Good morning. Kavya has a fever and will miss school today. Could you share what is covered in class?', at: 'Today, 8:05 AM' }] },
      { id: 't2', name: 'Arun V, HOD Physics', about: 'Staff', unread: true, messages: [{ from: 'me', text: 'Unit test paper for 11-A is in progress. I have the first section ready.', at: 'Yesterday, 4:30 PM' }, { from: 'them', text: 'Thanks. Please share the draft by Friday so we can moderate it.', at: 'Yesterday, 5:12 PM' }] },
      { id: 't3', name: 'Class 12 - B', about: '31 students', unread: false, messages: [{ from: 'me', text: 'Bring your lab manuals tomorrow. We will do the electroscope practical.', at: 'Yesterday, 3:45 PM' }] },
      { id: 't4', name: 'Parent of Tharun', about: 'Class 11 - B', unread: false, messages: [{ from: 'them', text: 'Thank you for the extra worksheet. It helped a lot.', at: 'Mon, 6:40 PM' }, { from: 'me', text: 'Glad to hear it. Tharun did well on the motion graphs too.', at: 'Mon, 7:15 PM' }] },
    ],
    activity: [
      { id: 'x1', classId: '12-a', kind: 'assignment', text: 'New assignment: Chapter 1 Quiz', at: 'Today, 10:30 AM' },
      { id: 'x2', classId: '12-a', kind: 'material', text: 'Material uploaded: Electric Fields', at: 'Yesterday, 6:20 PM' },
      { id: 'x3', classId: '12-a', kind: 'attendance', text: 'Attendance marked', at: 'Yesterday, 9:15 AM' },
      { id: 'x4', classId: '12-b', kind: 'quiz', text: 'Quiz published: Mid-Chapter Test', at: 'Yesterday, 2:10 PM' },
      { id: 'x5', classId: '11-a', kind: 'assignment', text: 'Assignment scheduled: Worksheet - Unit 1', at: 'Yesterday, 4:00 PM' },
      { id: 'x6', classId: '11-b', kind: 'material', text: 'Material uploaded: Vernier calliper simulator', at: 'Mon, 11:20 AM' },
    ],
    settings: { name: 'Ms. Nandhini', email: '', theme: 'system', notify: { submissions: true, messages: true, attendance: true } },
  }
}
