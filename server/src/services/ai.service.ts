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
}`
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
}`
  );
}

async function callExtractProfile(parsedText: string) {
  return generateJSON<ExtractedProfile>(
    `Extract structured profile information from this resume. Return JSON with exactly this shape:
{
  "name": "full name or null",
  "email": "email address or null",
  "phone": "phone number or null",
  "location": "city and/or country or null",
  "summary": "professional summary in 2-3 sentences or null",
  "skills": ["skill1", "skill2"],
  "education": [{ "institution": "...", "degree": "...", "field": "... or null", "startYear": 2018, "endYear": 2022 }],
  "experience": [{ "company": "...", "title": "...", "location": "... or null", "startDate": "2020-01 or null", "endDate": "2023-06 or null", "current": false, "description": "..." }],
  "certifications": [{ "name": "...", "issuer": "... or null", "year": 2021 }]
}

Resume text:
${parsedText}`
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
