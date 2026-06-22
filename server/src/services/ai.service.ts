import { generateJSON, generateText } from '../lib/ai';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/AppError';

export interface ExtractedProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  skills: string[];
  education: { institution: string; degree: string; field: string | null; startYear: number | null; endYear: number | null }[];
  experience: { company: string; title: string; location: string | null; startDate: string | null; endDate: string | null; current: boolean; description: string }[];
  certifications: { name: string; issuer: string | null; year: number | null }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getApplicationWithResume(applicationId: string, userId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      companyName: true,
      jobTitle: true,
      jobDescription: true,
      resumeId: true,
      resume: { select: { parsedText: true } },
      user: { select: { name: true } },
    },
  });
  if (!application) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (application.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  if (!application.resumeId || !application.resume?.parsedText) {
    throw new AppError(400, 'RESUME_REQUIRED', 'A resume with parsed text is required for AI features');
  }
  return application as typeof application & { resume: { parsedText: string } };
}

// ─── Pure AI calls (swap provider by editing ai.ts only — do not touch these) ──

async function callAnalyze(resumeText: string, jobDescription: string) {
  return generateJSON<{ score: number; matched: string[]; missing: string[]; suggestions: string[] }>(
    `You are an expert technical recruiter helping a candidate assess their job application fit.

CANDIDATE RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Analyze the match and return JSON with exactly these keys:
{
  "score": <integer 0-100 representing overall fit>,
  "matched": [<keywords/skills present in both resume and JD>],
  "missing": [<important keywords/skills in JD not in resume>],
  "suggestions": [<specific, actionable resume improvement suggestions>]
}`,
    2500
  );
}

async function callCoverLetter(
  resumeText: string,
  jobDescription: string,
  applicantName: string,
  companyName: string,
  jobTitle: string,
  tone?: string
) {
  return generateText(
    `Write a professional cover letter for ${applicantName} applying for ${jobTitle} at ${companyName}.
${tone ? `Tone: ${tone}.` : ''}

CANDIDATE RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Instructions:
- Approximately 300 words
- Reference specific skills and experiences from the resume that match the job description
- Do NOT invent experience not present in the resume
- Format: "Dear Hiring Manager," opening, 3 body paragraphs, "Sincerely,\\n${applicantName}" closing
- Return plain text only, no markdown`
  );
}

async function callInterviewQuestions(resumeText: string, jobDescription: string, companyName: string) {
  return generateJSON<{ questions: Array<{ question: string; category: string; tips: string }> }>(
    `You are a senior technical interviewer preparing a candidate for an interview at ${companyName}.

CANDIDATE RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Generate exactly 8 interview questions: 3 technical, 3 behavioral, 2 company-specific.
Return JSON with exactly this shape:
{
  "questions": [
    { "question": "...", "category": "technical|behavioral|company", "tips": "..." }
  ]
}`,
    3000
  );
}

async function callExtractProfile(parsedText: string) {
  return generateJSON<ExtractedProfile>(
    `You are extracting a structured profile from a resume to build a master career record.
This profile will later be used to generate tailored resumes for specific job descriptions,
so the EXPERIENCE section must preserve every detail — do NOT summarise or abbreviate.

Rules for "title" and "company" in each experience entry (READ CAREFULLY):
- For EMPLOYMENT (jobs, internships): "title" = the job/role title (e.g. "Software Engineer Intern", "Backend Developer"); "company" = the employer/organization (e.g. "Shanghai Huiyin").
- For PROJECTS / competitions / programs / research: "title" = the actual PROJECT NAME exactly as written in the resume (e.g. "Lightweight Object Detection on Edge Devices", "College Student Innovation and Entrepreneurship Program"); "company" = the role or nature of the work (e.g. "Deputy Leader", "Research Project", "Team Lead", "Personal Project").
- NEVER make "title" and "company" identical. If you cannot find a distinct value for one of them, look harder in the resume text; only as a last resort set "company" to a short role/context word and keep the specific name in "title".
- NEVER use a generic section label (like "Research Project", "Project", "Experience") as the "title" when the resume actually contains a specific project name — extract the real name.
- The specific identifying NAME always goes in "title" so it appears as the heading.

Rules for the "description" field inside each experience entry:
- Copy ALL bullet points and responsibilities from the original resume text verbatim or near-verbatim.
- Include specific metrics, numbers, technologies, tools, methodologies mentioned in the resume.
- Preserve the full wording of achievements (e.g. "Reduced API latency by 40% by migrating to Redis caching").
- Do NOT collapse multiple bullet points into one sentence.
- Do NOT omit any responsibility or achievement, even if it seems minor.
- Format as a single string with each bullet separated by "\\n• " (newline + bullet).
  Example: "• Led migration of monolithic app to microservices on AWS ECS\\n• Reduced deployment time from 45 minutes to 8 minutes using GitHub Actions CI/CD\\n• Mentored 3 junior engineers through code review and pair programming"

Rules for "education":
- Extract EVERY education entry (every school, university, degree, diploma, exchange program) — do not stop at the first one.

Rules for "skills":
- List each distinct skill only ONCE. Do not output duplicates or case-variants of the same skill (e.g. never both "SQL" and "sql").

Rules for the "certifications" array (this section covers BOTH certifications AND awards/honors):
- Capture every certification, license, AND every award, honor, prize, scholarship, or competition placement mentioned anywhere in the resume.
- "name" = the certification or award name (e.g. "AWS Certified Solutions Architect", "First Prize, National Mathematical Modeling Contest", "Merit Scholarship").
- "issuer" = the issuing/awarding body if stated, else null. "year" = the year if stated, else null.
- Do NOT drop awards just because they are not certifications — they belong here.

Return JSON with exactly this shape:
{
  "name": "full name or null",
  "email": "email address or null",
  "phone": "phone number or null",
  "location": "city and/or country or null",
  "summary": "professional summary preserving original wording, or null",
  "skills": ["every individual skill, tool, language, framework mentioned in the resume"],
  "education": [{ "institution": "...", "degree": "...", "field": "... or null", "startYear": 2018, "endYear": 2022 }],
  "experience": [{ "company": "...", "title": "...", "location": "... or null", "startDate": "2020-01 or null", "endDate": "2023-06 or null", "current": false, "description": "full bullet-by-bullet detail as described above" }],
  "certifications": [{ "name": "...", "issuer": "... or null", "year": 2021 }]
}

Resume text:
${parsedText}`,
    6000
  );
}

// ─── Public service methods ───────────────────────────────────────────────────

export async function analyzeApplication(applicationId: string, userId: string) {
  const application = await getApplicationWithResume(applicationId, userId);

  const analysis = await callAnalyze(
    application.resume.parsedText,
    application.jobDescription
  );

  await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId },
      data: { matchScore: analysis.score, matchAnalysis: analysis },
    }),
    prisma.applicationEvent.create({
      data: { applicationId, eventType: 'ANALYSIS_COMPLETED' },
    }),
  ]);

  return analysis;
}

export async function generateCoverLetter(
  applicationId: string,
  userId: string,
  tone?: string
) {
  const application = await getApplicationWithResume(applicationId, userId);
  const applicantName = application.user.name ?? 'Candidate';

  const content = await callCoverLetter(
    application.resume.parsedText,
    application.jobDescription,
    applicantName,
    application.companyName,
    application.jobTitle,
    tone
  );

  const existingCount = await prisma.coverLetter.count({ where: { applicationId } });

  const coverLetter = await prisma.$transaction(async (tx) => {
    await tx.coverLetter.updateMany({
      where: { applicationId, isActive: true },
      data: { isActive: false },
    });
    const created = await tx.coverLetter.create({
      data: {
        applicationId,
        content,
        version: existingCount + 1,
        isActive: true,
      },
    });
    await tx.applicationEvent.create({
      data: { applicationId, eventType: 'COVER_LETTER_GENERATED' },
    });
    return created;
  });

  return coverLetter;
}

export async function generateInterviewQuestions(applicationId: string, userId: string) {
  const application = await getApplicationWithResume(applicationId, userId);

  const { questions } = await callInterviewQuestions(
    application.resume.parsedText,
    application.jobDescription,
    application.companyName
  );

  const interviewPrep = await prisma.$transaction(async (tx) => {
    const prep = await tx.interviewPrep.upsert({
      where: { applicationId },
      create: { applicationId, questions },
      update: { questions, updatedAt: new Date() },
    });
    await tx.applicationEvent.create({
      data: { applicationId, eventType: 'INTERVIEW_PREP_GENERATED' },
    });
    return prep;
  });

  return interviewPrep;
}

export async function updateCoverLetter(
  coverLetterId: string,
  userId: string,
  content: string
) {
  const coverLetter = await prisma.coverLetter.findUnique({
    where: { id: coverLetterId },
    include: { application: { select: { userId: true } } },
  });
  if (!coverLetter) throw new AppError(404, 'COVER_LETTER_NOT_FOUND', 'Cover letter not found');
  if (coverLetter.application.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  return prisma.coverLetter.update({
    where: { id: coverLetterId },
    data: { content },
    select: { id: true, content: true, version: true, updatedAt: true },
  });
}

export async function getCoverLetter(coverLetterId: string, userId: string) {
  const coverLetter = await prisma.coverLetter.findUnique({
    where: { id: coverLetterId },
    include: { application: { select: { userId: true, companyName: true, jobTitle: true } } },
  });
  if (!coverLetter) throw new AppError(404, 'COVER_LETTER_NOT_FOUND', 'Cover letter not found');
  if (coverLetter.application.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  return coverLetter;
}

export async function extractProfileFromResume(parsedText: string): Promise<ExtractedProfile> {
  return callExtractProfile(parsedText);
}

// ─── Phase 2: smart experience merge ──────────────────────────────────────────

type Experience = ExtractedProfile['experience'][number];

export interface ExperienceMergeMatch {
  existingIndex: number; // index into the existing[] array passed in
  incomingIndex: number; // index into the incoming[] array passed in
  confidence: number;    // 0..1
  reason: string;
  merged: Experience;    // the combined entry to replace existing[existingIndex]
}

// Detect incoming experiences that describe the SAME real-world role/project as an
// existing profile entry (even under a different title), and produce a merged entry
// that unions all detail. Returns [] when there's nothing to compare or no confident match.
export async function detectExperienceMerges(
  existing: Experience[],
  incoming: Experience[]
): Promise<ExperienceMergeMatch[]> {
  if (existing.length === 0 || incoming.length === 0) return [];

  const result = await generateJSON<{ matches: ExperienceMergeMatch[] }>(
    `You are aggregating a candidate's work/project history from multiple resumes into ONE master profile.
You are given EXISTING profile experiences and INCOMING experiences from a newly added resume.
Some incoming entries may describe the SAME real-world role or project as an existing entry even if the
title or wording differs (e.g. "Full-Stack Website Developer" vs "Full-Stack Website For A Commercial Cafe (Mermaid Sushi Cafe)").

Identify those matches. Two entries match only if they refer to the same job or project — judge by
company/organization, overlapping time period, and overlapping responsibilities/technologies.
Entries at clearly different companies are NOT a match. Be conservative.

For each match, produce a MERGED entry that loses NO information:
- "title": the more specific/informative of the two titles
- "company": the more specific organization name
- "location": prefer a non-null value, else null
- "startDate"/"endDate": widest range (earliest start, latest end); "current": true if either is current
- "description": the UNION of every bullet and detail from BOTH descriptions. Combine overlapping bullets so
  the result contains every technology and fact from both. Example: merge
  "Designed and developed a website using TypeScript and Tailwind CSS" +
  "Designed and developed a production-grade bilingual website using Next.js, React" into
  "Designed and developed a production-grade bilingual website using Next.js, React, TypeScript, and Tailwind CSS".
  Keep the "\\n• " bullet format. Never drop a unique detail.

EXISTING (each item prefixed by its index):
${existing.map((e, i) => `[${i}] ${JSON.stringify(e)}`).join('\n')}

INCOMING (each item prefixed by its index):
${incoming.map((e, i) => `[${i}] ${JSON.stringify(e)}`).join('\n')}

Return JSON exactly:
{ "matches": [ { "existingIndex": <int>, "incomingIndex": <int>, "confidence": <0..1>, "reason": "<short>", "merged": { "company": "...", "title": "...", "location": null, "startDate": null, "endDate": null, "current": false, "description": "..." } } ] }
Only include matches with confidence >= 0.6. If there are none, return { "matches": [] }.`,
    3500
  );

  return (result.matches ?? []).filter(
    m =>
      Number.isInteger(m.existingIndex) && m.existingIndex >= 0 && m.existingIndex < existing.length &&
      Number.isInteger(m.incomingIndex) && m.incomingIndex >= 0 && m.incomingIndex < incoming.length &&
      m.merged != null
  );
}
