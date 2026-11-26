import { Route, Routes } from 'react-router-dom'
import { Compass } from 'lucide-react'
import Shell from './Shell'
import { Btn, Empty, Page } from './ui'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import { Classes, ClassDetails } from './pages/Classes'
import { Library, Upload } from './pages/Library'
import { Assignments, AssignmentDetail } from './pages/Assignments'
import { Quizzes, QuizEditor } from './pages/Quizzes'
import Attendance from './pages/Attendance'
import { Progress, Reports } from './pages/Insights'
import Messages from './pages/Messages'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/classes/:id" element={<ClassDetails />} />
        <Route path="/library" element={<Library />} />
        <Route path="/library/upload" element={<Upload />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/assignments/:id" element={<AssignmentDetail />} />
        <Route path="/quizzes" element={<Quizzes />} />
        <Route path="/quizzes/:id" element={<QuizEditor />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Page title="Page not found"><Empty icon={Compass} title="Nothing at this address" text="The link may be old, or the item was deleted." action={<Btn kind="primary" to="/">Go to dashboard</Btn>} /></Page>} />
      </Routes>
    </Shell>
  )
}
