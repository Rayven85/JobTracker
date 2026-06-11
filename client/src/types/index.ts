export interface User {
  id: string
  email: string
  name: string | null
  createdAt: string
}

export interface AuthResponse {
  user: User
  accessToken: string
}

export type ApplicationStatus =
  | 'WISHLIST'
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED'
  | 'WITHDRAWN'

export type EmploymentType = 'Full Time' | 'Part Time' | 'Contract' | 'Internship' | 'Graduate'

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Contact {
  id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  linkedInUrl: string | null
  notes: string | null
}

export interface ApplicationEvent {
  id: string
  eventType: string
  note: string | null
  createdAt: string
  oldStatus: ApplicationStatus | null
  newStatus: ApplicationStatus | null
}

export interface CoverLetter {
  id: string
  content: string
  version: number
  isActive: boolean
  tone: string | null
  createdAt: string
}

export interface InterviewQuestion {
  question: string
  category: 'technical' | 'behavioral' | 'company'
  tips: string
}

export interface AIAnalysis {
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  suggestions: string[]
}

export interface Resume {
  id: string
  name: string
  fileName: string
  fileSize: number
  parsedText: string | null
  isDefault: boolean
  createdAt: string
}

export interface Application {
  id: string
  companyName: string
  jobTitle: string
  status: ApplicationStatus
  location: string | null
  employmentType: string | null
  remote: boolean
  appliedDate: string | null
  deadline: string | null
  jobDescription: string | null
  jobUrl: string | null
  resumeId: string | null
  salaryMin: number | null
  salaryMax: number | null
  notes: string | null
  matchScore: number | null
  matchAnalysis: string | null
  tags: Tag[]
  contacts: Contact[]
  events: ApplicationEvent[]
  coverLetters: CoverLetter[]
  interviewPrep: { questions: InterviewQuestion[] } | null
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  totals: Record<ApplicationStatus, number>
  responseRate: number
  avgDaysToResponse: number
  activeApplications: number
}

export interface RecentActivityItem {
  id: string
  eventType: string
  note: string | null
  createdAt: string
  application: {
    id: string
    companyName: string
    jobTitle: string
  }
}
