import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';
import { signAccessToken } from '../lib/tokens';

jest.mock('../lib/s3', () => ({
  generatePresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned'),
  deleteS3Object: jest.fn().mockResolvedValue(undefined),
  // Reject so extractAndSaveText fails silently — no real PDF in tests
  getS3ObjectBuffer: jest.fn().mockRejectedValue(new Error('S3 not available in tests')),
}));

let userId: string;
let token: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: 'resume@test.jobtracker', password: 'hashed' },
  });
  userId = user.id;
  token = signAccessToken(userId, user.email);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.jobtracker' } } });
  await prisma.$disconnect();
});

describe('POST /api/v1/resumes/presigned-url', () => {
  it('returns presigned URL and s3Key in correct format', async () => {
    const res = await request(app)
      .post('/api/v1/resumes/presigned-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ fileName: 'cv.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.data.presignedUrl).toBe('https://s3.example.com/presigned');
    expect(res.body.data.s3Key).toMatch(new RegExp(`^resumes/${userId}/.+\\.pdf$`));
  });
});

describe('POST /api/v1/resumes/confirm', () => {
  it('creates Resume row with correct fields', async () => {
    const res = await request(app)
      .post('/api/v1/resumes/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        s3Key: `resumes/${userId}/abc123.pdf`,
        fileName: 'my-cv.pdf',
        fileSize: 54321,
        name: 'My Test CV',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('My Test CV');
    expect(res.body.data.fileName).toBe('my-cv.pdf');
    expect(res.body.data.fileSize).toBe(54321);

    const dbResume = await prisma.resume.findUnique({ where: { id: res.body.data.id } });
    expect(dbResume).not.toBeNull();
    expect(dbResume!.userId).toBe(userId);
  });
});

describe('GET /api/v1/resumes/:id', () => {
  it('returns 403 when userId does not match', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'other-resume@test.jobtracker', password: 'hashed' },
    });
    const otherResume = await prisma.resume.create({
      data: {
        userId: otherUser.id,
        s3Key: `resumes/${otherUser.id}/other.pdf`,
        fileName: 'other.pdf',
        fileSize: 999,
        name: 'Other CV',
      },
    });

    const res = await request(app)
      .get(`/api/v1/resumes/${otherResume.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

describe('DELETE /api/v1/resumes/:id', () => {
  it('returns 404 if resume does not exist', async () => {
    const res = await request(app)
      .delete('/api/v1/resumes/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
  });

  it('removes resume from DB', async () => {
    const resume = await prisma.resume.create({
      data: {
        userId,
        s3Key: `resumes/${userId}/to-delete.pdf`,
        fileName: 'to-delete.pdf',
        fileSize: 100,
        name: 'To Delete',
      },
    });

    const res = await request(app)
      .delete(`/api/v1/resumes/${resume.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dbResume = await prisma.resume.findUnique({ where: { id: resume.id } });
    expect(dbResume).toBeNull();
  });
});

describe('PATCH /api/v1/resumes/:id/extracted-data', () => {
  const payload = {
    name: 'Rayven',
    skills: ['Rust'],
    education: [],
    experience: [{ company: 'Acme', title: 'Engineer', current: false, description: 'Built things' }],
    certifications: [],
  };

  it('returns 403 when editing another user\'s resume', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'ed-other@test.jobtracker', password: 'hashed' },
    });
    const otherResume = await prisma.resume.create({
      data: { userId: otherUser.id, s3Key: `resumes/${otherUser.id}/x.pdf`, fileName: 'x.pdf', fileSize: 1, name: 'X' },
    });

    const res = await request(app)
      .patch(`/api/v1/resumes/${otherResume.id}/extracted-data`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('persists extractedData and returns suggestion: null when user has no profile', async () => {
    await prisma.userProfile.deleteMany({ where: { userId } });
    const resume = await prisma.resume.create({
      data: { userId, s3Key: `resumes/${userId}/ed1.pdf`, fileName: 'ed1.pdf', fileSize: 1, name: 'ED1' },
    });

    const res = await request(app)
      .patch(`/api/v1/resumes/${resume.id}/extracted-data`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.suggestion).toBeNull();
    expect(res.body.data.resume.extractedData.skills).toContain('Rust');

    const db = await prisma.resume.findUnique({ where: { id: resume.id } });
    expect((db!.extractedData as { skills: string[] }).skills).toContain('Rust');
  });

  it('returns a suggestion when the edit introduces items new to the profile', async () => {
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId },
      update: { skills: [], experience: [], education: [], certifications: [] },
    });
    const resume = await prisma.resume.create({
      data: { userId, s3Key: `resumes/${userId}/ed2.pdf`, fileName: 'ed2.pdf', fileSize: 1, name: 'ED2' },
    });

    const res = await request(app)
      .patch(`/api/v1/resumes/${resume.id}/extracted-data`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.suggestion).not.toBeNull();
    expect(res.body.data.suggestion.newSkills).toContain('Rust');
    expect(res.body.data.suggestion.resumeId).toBe(resume.id);
  });
});
