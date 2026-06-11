import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';
import { signAccessToken } from '../lib/tokens';

let userId: string;
let token: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: 'app@test.jobtracker', password: 'hashed' },
  });
  userId = user.id;
  token = signAccessToken(userId, user.email);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.jobtracker' } } });
  await prisma.$disconnect();
});

const baseApplication = {
  companyName: 'Xero',
  jobTitle: 'Software Engineer',
  jobDescription: 'Build great accounting software.',
};

describe('POST /api/v1/applications', () => {
  it('creates both Application and CREATED event', async () => {
    const res = await request(app)
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .send(baseApplication);

    expect(res.status).toBe(201);
    expect(res.body.data.companyName).toBe('Xero');
    expect(res.body.data.status).toBe('WISHLIST');

    const events = await prisma.applicationEvent.findMany({
      where: { applicationId: res.body.data.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('CREATED');
  });
});

describe('GET /api/v1/applications', () => {
  beforeAll(async () => {
    // Create applications with different statuses for filter tests
    await prisma.application.createMany({
      data: [
        { ...baseApplication, userId, companyName: 'ASB', jobTitle: 'Frontend Dev', status: 'APPLIED' },
        { ...baseApplication, userId, companyName: 'Orion Health', jobTitle: 'Backend Dev', status: 'INTERVIEW' },
        { ...baseApplication, userId, companyName: 'Spark', jobTitle: 'DevOps Engineer', status: 'APPLIED' },
      ],
    });
  });

  it('status filter returns only matching applications', async () => {
    const res = await request(app)
      .get('/api/v1/applications?status=APPLIED')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.every((a: { status: string }) => a.status === 'APPLIED')).toBe(true);
  });

  it('search filter is case-insensitive', async () => {
    const res = await request(app)
      .get('/api/v1/applications?search=orion')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.items.some((a: { companyName: string }) =>
        a.companyName.toLowerCase().includes('orion')
      )
    ).toBe(true);
  });
});

describe('PATCH /api/v1/applications/:id/status', () => {
  it('creates STATUS_CHANGED event with correct old and new status', async () => {
    const createRes = await request(app)
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .send(baseApplication);

    const applicationId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPLIED', note: 'Submitted via company website' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPLIED');

    const event = await prisma.applicationEvent.findFirst({
      where: { applicationId, eventType: 'STATUS_CHANGED' },
    });
    expect(event).not.toBeNull();
    expect(event!.oldStatus).toBe('WISHLIST');
    expect(event!.newStatus).toBe('APPLIED');
    expect(event!.note).toBe('Submitted via company website');
  });
});

describe('GET /api/v1/applications/:id', () => {
  let applicationId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .send(baseApplication);
    applicationId = res.body.data.id;
  });

  it('returns 403 for wrong user', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'other-app@test.jobtracker', password: 'hashed' },
    });
    const otherToken = signAccessToken(otherUser.id, otherUser.email);

    const res = await request(app)
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('includes all relations in response', async () => {
    const res = await request(app)
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(Array.isArray(data.events)).toBe(true);
    expect(Array.isArray(data.contacts)).toBe(true);
    expect(Array.isArray(data.tags)).toBe(true);
    expect(Array.isArray(data.coverLetters)).toBe(true);
    // interviewPrep is null until generated — just check the key exists
    expect('interviewPrep' in data).toBe(true);
  });
});
