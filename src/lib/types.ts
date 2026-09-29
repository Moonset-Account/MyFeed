export type Proficiency = 1 | 2 | 3 | 4 | 5

export interface Course {
  id: string
  name: string
  examDate: string
  color: string
}

export interface Chapter {
  id: string
  courseId: string
  title: string
  order: number
  proficiency: Proficiency
  completedUnits: number
}

export interface ReviewRecord {
  id: string
  chapterId: string
  courseId: string
  date: string
  units: number
  createdAt: string
}

export interface Absence {
  id: string
  date: string
  reason: string
}

export interface PlannerState {
  version: 1
  courses: Course[]
  chapters: Chapter[]
  records: ReviewRecord[]
  absences: Absence[]
}

export interface ChapterView {
  chapter: Chapter
  course?: Course
  totalUnits: number
  remainingUnits: number
  completedUnits: number
  progress: number
}

export interface CourseStat {
  course: Course
  totalUnits: number
  completedUnits: number
  remainingUnits: number
  chapterCount: number
  daysLeft: number
  progress: number
  status: 'completed' | 'today' | 'upcoming' | 'overdue'
}

export interface Assignment {
  chapterId: string
  courseId: string
  date: string
  units: number
}

export interface AssignmentGroup {
  chapter: Chapter
  course: Course
  units: number
}

export interface DayPlan {
  date: string
  items: AssignmentGroup[]
  totalUnits: number
  minutes: number
  absence?: Absence
  examCourses: Course[]
}

export interface CoursePlan {
  course: Course
  studyDates: string[]
  assignments: Assignment[]
  remainingUnits: number
  overdueUnits: number
  overloaded: boolean
}

export interface StudyPlan {
  today: string
  coursePlans: CoursePlan[]
  assignmentsByDate: Map<string, Assignment[]>
  overdueChapters: ChapterView[]
}
