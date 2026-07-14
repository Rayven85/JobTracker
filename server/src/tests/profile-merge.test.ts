import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';
import { signAccessToken } from '../lib/tokens';

// ─── Mock Groq SDK at the module boundary (same pattern as ai.test.ts) ─────────
jest.mock('groq-sdk', () => {
  const create = jest.fn();
  const Groq = jest.fn().mockImplementation(() => ({
    chat: { completions: { create } },
  }));
  return { __esModule: true, default: Groq, _create: create };
});

const { _create: mockCreate } = jest.requireMock('groq-sdk') as { _create: jest.Mock };

function groqJSON(obj: unknown) {
  return { choices: [{ message: { content: JSON.stringify(obj) } }] };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let userId: string;
let token: string;
let s3Counter = 0;

const emptyExtracted = {
  name: null, email: null, phone: null, location: null, summary: null,
  skills: [], education: [], experience: [], certifications: [],
};

async function createResumeWithData(extractedData: object | null, name = 'R') {
  return prisma.resume.create({
    data: {
      userId,
      s3Key: `resumes/${userId}/merge-${s3Counter++}.pdf`,
      fileName: 'r.pdf',
      fileSize: 1,
      name,
      extractionStatus: 'READY',
      parsedText: 'placeholder resume text',
      // reason: Prisma Json field requires object cast
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(extractedData ? { extractedData: extractedData as any } : {}),
    },
  });
}

async function setProfile(fields: object) {
  await prisma.userProfile.upsert({
    where: { userId },
    // reason: Prisma Json fields require cast when writing typed arrays
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { userId, ...(fields as any) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: {
      skills: [], education: [], experience: [], certifications: [], syncedResumeIds: [],
      ...(fields as any),
    },
  });
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: 'profile-merge@test.jobtracker', password: 'hashed', name: 'Merge Tester' },
  });
  userId = user.id;
  token = signAccessToken(userId, user.email);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.jobtracker' } } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  mockCreate.mockReset();
  await prisma.resume.deleteMany({ where: { userId } });
  await setProfile({});
});

// ─── GET /profile — suggestion diffing (computeSuggestions) ───────────────────

describe('GET /api/v1/profile — suggestions', () => {
  it('dedupes skills case-insensitively and only suggests genuinely new items', async () => {
    await setProfile({ skills: ['SQL', 'React'] });
    await createResumeWithData({ ...emptyExtracted, skills: ['sql', 'react', 'Docker'] });

    const res = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toHaveLength(1);
    expect(res.body.data.suggestions[0].newSkills).toEqual(['Docker']);
  });

  it('matches experience by company+title (case-insensitive) and education by institution+degree', async () => {
    const exp = { company: 'Acme', title: 'Engineer', location: null, startDate: null, endDate: null, current: false, description: '' };
    const edu = { institution: 'UoA', degree: 'BSc', field: null, startYear: null, endYear: null };
    await setProfile({ experience: [exp], education: [edu] });

    await createResumeWithData({
      ...emptyExtracted,
      // same identity, different casing → NOT new; different title → new
      experience: [
        { ...exp, company: 'ACME', title: 'engineer' },
        { ...exp, title: 'Senior Engineer' },
      ],
      education: [edu, { ...edu, degree: 'MSc' }],
    });

    const res = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${token}`);

    const suggestion = res.body.data.suggestions[0];
    expect(suggestion.newExperience).toHaveLength(1);
    expect(suggestion.newExperience[0].title).toBe('Senior Engineer');
    expect(suggestion.newEducation).toHaveLength(1);
    expect(suggestion.newEducation[0].degree).toBe('MSc');
  });

  it('emits no suggestion when the resume adds nothing new', async () => {
    await setProfile({ skills: ['TypeScript'] });
    await createResumeWithData({ ...emptyExtracted, skills: ['typescript'] });

    const res = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${token}`);

    expect(res.body.data.suggestions).toHaveLength(0);
  });

  it('skips resumes whose extraction has not produced data yet', async () => {
    await createResumeWithData(null);

    const res = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${token}`);

    expect(res.body.data.suggestions).toHaveLength(0);
  });
});

// ─── DELETE /profile/sync/:resumeId — dismiss ─────────────────────────────────

describe('DELETE /api/v1/profile/sync/:resumeId', () => {
  it('dismissed resumes stop appearing as suggestions', async () => {
    const resume = await createResumeWithData({ ...emptyExtracted, skills: ['Docker'] });

    const dismiss = await request(app)
      .delete(`/api/v1/profile/sync/${resume.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(dismiss.status).toBe(200);

    const res = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${token}`);
    expect(res.body.data.suggestions).toHaveLength(0);
  });

  it("returns 403 for another user's resume", async () => {
    const other = await prisma.user.create({
      data: { email: 'merge-other@test.jobtracker', password: 'hashed', name: 'Other' },
    });
    const foreign = await prisma.resume.create({
      data: { userId: other.id, s3Key: `resumes/${other.id}/f.pdf`, fileName: 'f.pdf', fileSize: 1, name: 'F' },
    });

    const res = await request(app)
      .delete(`/api/v1/profile/sync/${foreign.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ─── POST /profile/sync-plan/:resumeId — AI merge plan ────────────────────────

describe('POST /api/v1/profile/sync-plan/:resumeId', () => {
  const existingExp = {
    company: 'Cafe', title: 'Website Developer', location: null,
    startDate: null, endDate: null, current: false, description: '• Built a website',
  };
  const incomingExp = {
    company: 'Mermaid Sushi Cafe', title: 'Full-Stack Website', location: null,
    startDate: null, endDate: null, current: false, description: '• Production-grade website',
  };

  it('returns AI merges and filters out-of-range or malformed matches', async () => {
    await setProfile({ experience: [existingExp] });
    const resume = await createResumeWithData({ ...emptyExtracted, experience: [incomingExp] });

    const merged = { ...incomingExp, description: '• Built a production-grade website' };
    mockCreate.mockResolvedValueOnce(groqJSON({
      matches: [
        { existingIndex: 0, incomingIndex: 0, confidence: 0.9, reason: 'same project', merged },
        { existingIndex: 7, incomingIndex: 0, confidence: 0.9, reason: 'out of range', merged },
        { existingIndex: 0, incomingIndex: 0, confidence: 0.9, reason: 'no merged entry', merged: null },
      ],
    }));

    const res = await request(app)
      .post(`/api/v1/profile/sync-plan/${resume.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.merges).toHaveLength(1);
    expect(res.body.data.merges[0].merged.description).toBe('• Built a production-grade website');
    expect(res.body.data.existingExperience).toHaveLength(1);
    expect(res.body.data.suggestion.newExperience).toHaveLength(1);
  });

  it('returns an empty plan without calling the AI when the resume adds nothing', async () => {
    await setProfile({ skills: ['TypeScript'] });
    const resume = await createResumeWithData({ ...emptyExtracted, skills: ['TypeScript'] });

    const res = await request(app)
      .post(`/api/v1/profile/sync-plan/${resume.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ suggestion: null, merges: [], existingExperience: [] });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('skips AI merge detection when the profile has no experience to compare against', async () => {
    await setProfile({});
    const resume = await createResumeWithData({ ...emptyExtracted, experience: [incomingExp] });

    const res = await request(app)
      .post(`/api/v1/profile/sync-plan/${resume.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.merges).toEqual([]);
    expect(res.body.data.suggestion.newExperience).toHaveLength(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ─── POST /profile/build — buildProfileFromResumes ────────────────────────────

describe('POST /api/v1/profile/build', () => {
  it('extracts unprocessed resumes, surviving individual extraction failures', async () => {
    // Two READY resumes without extractedData; the mock fails for the one whose
    // parsedText carries a marker, so ordering does not matter.
    const failing = await prisma.resume.create({
      data: {
        userId, s3Key: `resumes/${userId}/fail-${s3Counter++}.pdf`, fileName: 'a.pdf',
        fileSize: 1, name: 'Failing', extractionStatus: 'READY', parsedText: 'FAIL_ME resume text',
      },
    });
    const succeeding = await prisma.resume.create({
      data: {
        userId, s3Key: `resumes/${userId}/ok-${s3Counter++}.pdf`, fileName: 'b.pdf',
        fileSize: 1, name: 'Succeeding', extractionStatus: 'READY', parsedText: 'good resume text',
      },
    });

    mockCreate.mockImplementation((body: { messages: { content: string }[] }) => {
      if (body.messages[0].content.includes('FAIL_ME')) {
        return Promise.reject(Object.assign(new Error('boom'), { status: 500 }));
      }
      return Promise.resolve(groqJSON({ ...emptyExtracted, skills: ['Docker'] }));
    });

    const res = await request(app)
      .post('/api/v1/profile/build')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const failedRow = await prisma.resume.findUnique({ where: { id: failing.id } });
    const okRow = await prisma.resume.findUnique({ where: { id: succeeding.id } });
    expect(failedRow!.extractedData).toBeNull();
    expect(okRow!.extractedData).not.toBeNull();

    // The successful extraction shows up as a suggestion in the same response
    const suggestions = res.body.data.suggestions as { resumeId: string }[];
    expect(suggestions.map(s => s.resumeId)).toEqual([succeeding.id]);
  });

  it('re-offers previously dismissed resumes by resetting syncedResumeIds', async () => {
    const resume = await createResumeWithData({ ...emptyExtracted, skills: ['Docker'] });

    await request(app)
      .delete(`/api/v1/profile/sync/${resume.id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/v1/profile/build')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const suggestions = res.body.data.suggestions as { resumeId: string }[];
    expect(suggestions.map(s => s.resumeId)).toEqual([resume.id]);
  });
});
