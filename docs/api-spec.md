# JobTracker API Specification

Base URL: `http://localhost:4000/api/v1`
All authenticated routes require: `Authorization: Bearer <accessToken>`
All responses follow: `{ success: true, data: {} }` or `{ success: false, error: { code, message } }`

---

## Auth

### POST /auth/register
```json
// Request
{ "email": "user@example.com", "password": "min8chars", "name": "Rayven Zhao" }

// Response 201
{ "success": true, "data": { "accessToken": "...", "user": { "id", "email", "name", "avatarUrl" } } }
// Sets HttpOnly cookie: refreshToken
```

### POST /auth/login
```json
// Request
{ "email": "user@example.com", "password": "..." }

// Response 200
{ "success": true, "data": { "accessToken": "...", "user": { "id", "email", "name", "avatarUrl" } } }
// Sets HttpOnly cookie: refreshToken
```

### POST /auth/refresh
```
// No request body — reads refreshToken from HttpOnly cookie
// Response 200
{ "success": true, "data": { "accessToken": "..." } }
// Rotates refreshToken cookie
```

### POST /auth/logout
```
// No request body — reads refreshToken cookie, revokes it in DB
// Response 200
{ "success": true, "data": null }
// Clears refreshToken cookie
```

### GET /auth/google
```
// Redirects to Google consent screen (Passport.js)
```

### GET /auth/google/callback
```
// Passport callback — finds or creates user
// Redirects to: {CLIENT_URL}/auth/callback?token=<accessToken>
// Sets HttpOnly refreshToken cookie
```

### GET /auth/me
```
// Auth required
// Response 200
{ "success": true, "data": { "id", "email", "name", "avatarUrl" } }
```

---

## Resumes

### GET /resumes
```
// Auth required
// Response 200
{ "success": true, "data": [
  { "id", "name", "fileName", "fileSize", "isDefault", "createdAt",
    "parsedTextPreview": "first 200 chars of parsedText" }
]}
```

### POST /resumes/presigned-url
```json
// Request
{ "fileName": "Rayven_CV.pdf", "contentType": "application/pdf" }

// Response 201
{ "success": true, "data": { "presignedUrl": "https://s3.amazonaws.com/...", "s3Key": "resumes/userId/abc.pdf" } }
```

### POST /resumes/confirm
```json
// Request — called after successful S3 upload
{ "s3Key": "resumes/userId/abc.pdf", "fileName": "Rayven_CV.pdf", "fileSize": 123456, "name": "Software Engineer v2" }

// Response 201
{ "success": true, "data": { "id", "name", "fileName", "fileSize", "isDefault", "createdAt" } }
// Background: triggers PDF text extraction job
```

### GET /resumes/:id
```
// Response 200
{ "success": true, "data": { "id", "name", "fileName", "fileSize", "isDefault", "s3Key", "createdAt" } }
```

### PATCH /resumes/:id
```json
// Request (all fields optional)
{ "name": "ML Engineer Resume" }

// Response 200
{ "success": true, "data": { ...updatedResume } }
```

### DELETE /resumes/:id
```
// Deletes from DB + removes from S3
// Response 200
{ "success": true, "data": null }
```

### POST /resumes/:id/set-default
```
// Sets this resume as default, clears isDefault on all others for this user
// Response 200
{ "success": true, "data": { ...updatedResume } }
```

---

## Applications

### GET /applications
```
// Query params (all optional):
//   status=APPLIED|SCREENING|INTERVIEW|OFFER|REJECTED|WITHDRAWN|WISHLIST
//   search=<company or title substring>
//   page=1&limit=20

// Response 200
{ "success": true, "data": {
  "items": [{ "id", "companyName", "jobTitle", "status", "matchScore",
               "appliedDate", "deadline", "location", "createdAt",
               "resume": { "id", "name" }, "tags": [{ "id", "name", "color" }] }],
  "total": 42,
  "page": 1,
  "limit": 20
}}
```

### POST /applications
```json
// Request
{
  "companyName": "Xero",
  "jobTitle": "Software Engineer",
  "jobDescription": "We are looking for...",
  "jobUrl": "https://...",
  "resumeId": "uuid",
  "location": "Auckland",
  "employmentType": "FULL_TIME",
  "isRemote": false,
  "appliedDate": "2026-06-01",
  "deadline": "2026-06-30",
  "salaryMin": 8000000,
  "salaryMax": 10000000,
  "status": "APPLIED",
  "notes": "Referred by..."
}

// Response 201
{ "success": true, "data": { ...fullApplication } }
// Side effect: creates ApplicationEvent of type CREATED
```

### GET /applications/:id
```
// Response 200 — full application with all relations
{ "success": true, "data": {
  "id", "companyName", "jobTitle", "jobDescription", "status",
  "matchScore", "matchAnalysis", "appliedDate", "deadline",
  "location", "salaryMin", "salaryMax", "employmentType", "isRemote",
  "notes", "createdAt", "updatedAt",
  "resume": { "id", "name", "fileName" },
  "coverLetters": [{ "id", "version", "isActive", "createdAt" }],
  "interviewPrep": { "id", "questions", "generatedAt" } | null,
  "contacts": [{ "id", "name", "role", "email", "linkedinUrl" }],
  "tags": [{ "id", "name", "color" }],
  "events": [{ "id", "eventType", "oldStatus", "newStatus", "note", "createdAt" }]
}}
```

### PATCH /applications/:id
```json
// Request (all fields optional — use for editing job details, notes, etc.)
{ "notes": "Had a great call with the recruiter", "deadline": "2026-07-01" }

// Response 200
{ "success": true, "data": { ...updatedApplication } }
```

### PATCH /applications/:id/status
```json
// Request
{ "status": "INTERVIEW", "note": "Phone screen scheduled for June 15" }

// Response 200
{ "success": true, "data": { "status": "INTERVIEW" } }
// Side effect: creates ApplicationEvent of type STATUS_CHANGED
```

### DELETE /applications/:id
```
// Response 200
{ "success": true, "data": null }
```

### GET /applications/:id/events
```
// Response 200
{ "success": true, "data": [
  { "id", "eventType", "oldStatus", "newStatus", "note", "metadata", "createdAt" }
]}
```

---

## AI Endpoints

### POST /applications/:id/analyze
```
// Triggers Claude analysis of resume vs JD
// Uses application.resume.parsedText + application.jobDescription
// Requires application to have a resume attached

// Response 200
{ "success": true, "data": {
  "score": 78,
  "matched": ["TypeScript", "React", "Node.js", "REST API"],
  "missing": ["Kubernetes", "GraphQL", "Microservices"],
  "suggestions": ["Add Kubernetes experience or describe container deployment", "..."]
}}
// Side effects:
//   - Saves matchScore + matchAnalysis to Application row
//   - Creates ApplicationEvent of type ANALYSIS_COMPLETED
```

### POST /applications/:id/cover-letter
```json
// Request (optional customization hints)
{ "tone": "enthusiastic" }

// Response 201
{ "success": true, "data": {
  "id": "cover-letter-uuid",
  "content": "Dear Hiring Manager,\n\nI am excited to apply...",
  "version": 1,
  "isActive": true,
  "createdAt": "2026-06-08T..."
}}
// Side effect: creates CoverLetter row, creates ApplicationEvent COVER_LETTER_GENERATED
```

### PATCH /cover-letters/:id
```json
// Request — user edited the generated cover letter
{ "content": "Dear Hiring Manager,\n\nI am applying for..." }

// Response 200
{ "success": true, "data": { "id", "content", "version", "updatedAt" } }
```

### GET /cover-letters/:id/download
```
// Returns plain text file as attachment for PDF printing
// Content-Type: text/plain; Content-Disposition: attachment; filename="cover-letter.txt"
```

### POST /applications/:id/interview-prep
```
// Generates interview questions — should be called after status is INTERVIEW

// Response 201
{ "success": true, "data": {
  "id": "...",
  "questions": [
    { "question": "Walk me through a complex full-stack feature you built end-to-end.",
      "category": "technical",
      "tips": "Structure: problem → approach → implementation → outcome. Mention specific tech." },
    { "question": "Tell me about a time you disagreed with a technical decision.",
      "category": "behavioral",
      "tips": "Use STAR. Show you can push back constructively and accept outcomes." }
  ],
  "generatedAt": "2026-06-08T..."
}}
// Side effect: creates ApplicationEvent INTERVIEW_PREP_GENERATED
```

---

## Contacts

### POST /applications/:id/contacts
```json
{ "name": "Alice Chen", "role": "Engineering Manager", "email": "alice@xero.com", "linkedinUrl": "..." }
// Response 201
{ "success": true, "data": { "id", "name", "role", "email", "linkedinUrl", "notes" } }
```

### PATCH /contacts/:id
```json
{ "notes": "Had a 30-min call. She mentioned team is hiring two engineers." }
// Response 200
{ "success": true, "data": { ...updatedContact } }
```

### DELETE /contacts/:id
```
// Response 200
{ "success": true, "data": null }
```

---

## Tags

### GET /tags
```
// Returns all tags for the authenticated user
{ "success": true, "data": [{ "id", "name", "color" }] }
```

### POST /tags
```json
{ "name": "NZ company", "color": "#10b981" }
// Response 201
{ "success": true, "data": { "id", "name", "color" } }
```

### POST /applications/:id/tags/:tagId
```
// Attaches a tag to an application
// Response 200
{ "success": true, "data": null }
```

### DELETE /applications/:id/tags/:tagId
```
// Detaches a tag from an application
// Response 200
{ "success": true, "data": null }
```

---

## Dashboard

### GET /dashboard/stats
```
// Response 200
{ "success": true, "data": {
  "totals": {
    "WISHLIST": 3, "APPLIED": 12, "SCREENING": 4,
    "INTERVIEW": 2, "OFFER": 1, "REJECTED": 5, "WITHDRAWN": 1
  },
  "responseRate": 0.58,           // (SCREENING + INTERVIEW + OFFER) / APPLIED
  "avgDaysToResponse": 8.3,       // avg days from appliedDate to first SCREENING event
  "activeApplications": 19        // all non-REJECTED, non-WITHDRAWN
}}
```

### GET /dashboard/recent
```
// Last 10 ApplicationEvents across all user's applications
// Response 200
{ "success": true, "data": [
  { "id", "eventType", "createdAt", "note",
    "application": { "id", "companyName", "jobTitle" } }
]}
```