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

export type ExtractionStatus = 'PENDING' | 'READY' | 'EMPTY' | 'FAILED'

export interface Resume {
  id: string
  name: string
  fileName: string
  fileSize: number
  // Lifecycle of background PDF text extraction. Drives the status pill on the resumes page.
  extractionStatus: ExtractionStatus
  // The list endpoint returns a 200-char preview (null until extraction finishes).
  // Absent on the confirm-upload response, hence optional.
  parsedTextPreview?: string | null
  // Full text — only present on GET /resumes/:id, not on list responses.
  parsedText?: string | null
  // AI-structured data — only present on GET /resumes/:id after AI extraction completes.
  extractedData?: {
    name: string | null
    email: string | null
    phone: string | null
    location: string | null
    summary: string | null
    skills: string[]
    education: ProfileEducation[]
    experience: ProfileExperience[]
    certifications: ProfileCertification[]
  } | null
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

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface ProfileEducation {
  institution: string
  degree: string
  field: string | null
  startYear: number | null
  endYear: number | null
}

export interface ProfileExperience {
  company: string
  title: string
  location: string | null
  startDate: string | null
  endDate: string | null
  current: boolean
  description: string
}

export interface ProfileCertification {
  name: string
  issuer: string | null
  year: number | null
}

export interface ProfileSuggestion {
  resumeId: string
  resumeName: string
  newSkills: string[]
  newExperience: ProfileExperience[]
  newEducation: ProfileEducation[]
  newCertifications: ProfileCertification[]
}

export interface UserProfile {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  location: string | null
  summary: string | null
  skills: string[]
  education: ProfileEducation[]
  experience: ProfileExperience[]
  certifications: ProfileCertification[]
  updatedAt: string
  suggestions: ProfileSuggestion[]
}
