export type ClassRoom = { id: string; name: string; subject: string; room: string; icon: 'atom' | 'flask' | 'microscope' | 'dna'; hue: 1 | 2 | 3 | 4 }
export type Subject = 'Physics' | 'Chemistry' | 'Maths' | 'Biology' | 'English'
export type Student = { id: string; roll: number; name: string; classId: string; guardian: string; phone: string; tests: number[]; subjects: Record<Subject, number> }
export type MaterialType = 'SCORM' | 'PDF' | 'Video' | 'Slides' | 'Link'
/** Result of validating a SCORM package. `pending` means validation has not finished (or never ran on an older item). */
export type PackageInfo = { status: 'ready' | 'pending' | 'failed'; version?: string; launch?: string; files?: number; reason?: string }
export type Material = { id: string; title: string; classId: string; subject: string; type: MaterialType; description: string; size: string; file: string; visible: boolean; date: string; package?: PackageInfo }
export type Submission = { studentId: string; mark: number | null; at: string }
export type Assignment = { id: string; title: string; classId: string; due: string; opens: string; maxMark: number; instructions: string; submissions: Submission[] }
export type Question = { text: string; options: string[]; answer: number }
export type Quiz = { id: string; title: string; classId: string; minutes: number; planned: number; questions: Question[]; published: boolean; attempts: number; average: number | null }
export type Mark = 'P' | 'A' | 'L'
export type Period = { day: number; start: string; end: string; classId: string }
export type ChapterState = 'todo' | 'doing' | 'done'
export type Chapter = { title: string; periods: number; state: ChapterState }
export type Message = { from: 'me' | 'them'; text: string; at: string }
export type Thread = { id: string; name: string; about: string; unread: boolean; messages: Message[] }
export type Activity = { id: string; classId: string; text: string; at: string; kind: 'assignment' | 'material' | 'attendance' | 'quiz' }
export type Settings = { name: string; email: string; theme: 'system' | 'light' | 'dark'; notify: { submissions: boolean; messages: boolean; attendance: boolean } }
export type DB = {
  classes: ClassRoom[]
  students: Student[]
  materials: Material[]
  assignments: Assignment[]
  quizzes: Quiz[]
  /** Keyed `${classId}:${yyyy-mm-dd}`, then by student id. */
  attendance: Record<string, Record<string, Mark>>
  timetable: Period[]
  syllabus: Record<string, Chapter[]>
  threads: Thread[]
  activity: Activity[]
  settings: Settings
}
