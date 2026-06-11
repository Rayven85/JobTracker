import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';
import { signAccessToken } from '../lib/tokens';

// ─── Mock Gemini ──────────────────────────────────────────────────────────────
// generateContent is created inside the factory to avoid TDZ — the const
// variable would be uninitialized when jest.mock() hoists and runs the factory.

jest.mock('@google/generative-ai', () => {
  const generateContent = jest.fn();
  const GoogleGenerativeAI = jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({ generateContent }),
  }));
  return { GoogleGenerativeAI, _generateContent: generateContent };
});

const { _generateContent: mockGenerateContent } = jest.requireMock(
  '@google/generative-ai'
) as { _generateContent: jest.Mock };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let userId: string;
let token: string;
let applicationId: string;
let noResumeApplicationId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: 'ai@test.jobtracker', password: 'hashed', name: 'AI Tester' },
  });
  userId = user.id;
  token = signAccessToken(userId, user.email);

  const resume = await prisma.resume.create({
    data: {
      userId,
      s3Key: `resumes/${userId}/ai-test.pdf`,
      fileName: 'ai-test.pdf',
      fileSize: 1234,
      name: 'AI Test Resume',
      parsedText: 'Experienced TypeScript and React developer with 5 years building web apps.',
    },
  });

  const application = await prisma.application.create({
    data: {
      userId,
      resumeId: resume.id,
      companyName: 'Xero',
      jobTitle: 'Senior Software Engineer',
      jobDescription: 'Looking for TypeScript, React, and Node.js expertise.',
    },
  });
  applicationId = application.id;

  const noResumeApp = await prisma.application.create({
    data: {
      userId,
      companyName: 'ASB',
      jobTitle: 'Junior Dev',
      jobDescription: 'Entry level position.',
    },
  });
  noResumeApplicationId = noResumeApp.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.jobtracker' } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  mockGenerateContent.mockReset();
});

// ─── analyzeApplication ────────────────────────────────────────────────────────

describe('POST /api/v1/applications/:id/analyze', () => {
  it('returns correct shape and updates Application row', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({
          score: 85,
          matched: ['TypeScript', 'React'],
          missing: ['Kubernetes'],
          suggestions: ['Add container deployment experience'],
        }),
      },
    });

    const res = await request(app)
      .post(`/api/v1/applications/${applicationId}/analyze`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.score).toBe(85);
    expect(res.body.data.matched).toContain('TypeScript');
    expect(Array.isArray(res.body.data.missing)).toBe(true);
    expect(Array.isArray(res.body.data.suggestions)).toBe(true);

    const updated = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(updated!.matchScore).toBe(85);
    expect(updated!.matchAnalysis).toBeTruthy();
  });

  it('returns 400 when no resume is attached', async () => {
    const res = await request(app)
      .post(`/api/v1/applications/${noResumeApplicationId}/analyze`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESUME_REQUIRED');
  });
});

// ─── generateCoverLetter ──────────────────────────────────────────────────────

describe('POST /api/v1/applications/:id/cover-letter', () => {
  it('creates CoverLetter row with isActive: true', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          'Dear Hiring Manager,\n\nI am excited to apply.\n\nSincerely,\nAI Tester',
      },
    });

    const res = await request(app)
      .post(`/api/v1/applications/${applicationId}/cover-letter`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.isActive).toBe(true);
    expect(typeof res.body.data.content).toBe('string');
    expect(res.body.data.version).toBeGreaterThanOrEqual(1);

    const dbLetter = await prisma.coverLetter.findUnique({ where: { id: res.body.data.id } });
    expect(dbLetter).not.toBeNull();
    expect(dbLetter!.isActive).toBe(true);
  });

  it('returns 400 when no resume is attached', async () => {
    const res = await request(app)
      .post(`/api/v1/applications/${noResumeApplicationId}/cover-letter`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESUME_REQUIRED');
  });
});

// ─── generateInterviewQuestions ───────────────────────────────────────────────

describe('POST /api/v1/applications/:id/interview-prep', () => {
  it('creates 8 questions and persists InterviewPrep row', async () => {
    const questions = Array.from({ length: 8 }, (_, i) => ({
      question: `Question ${i + 1}?`,
      category: i < 3 ? 'technical' : i < 6 ? 'behavioral' : 'company',
      tips: `Tip ${i + 1}`,
    }));

    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ questions }) },
    });

    const res = await request(app)
      .post(`/api/v1/applications/${applicationId}/interview-prep`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect((res.body.data.questions as unknown[]).length).toBe(8);

    const dbPrep = await prisma.interviewPrep.findUnique({ where: { applicationId } });
    expect(dbPrep).not.toBeNull();
    expect((dbPrep!.questions as unknown[]).length).toBe(8);
  });

  it('returns 400 when no resume is attached', async () => {
    const res = await request(app)
      .post(`/api/v1/applications/${noResumeApplicationId}/interview-prep`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESUME_REQUIRED');
  });
});
