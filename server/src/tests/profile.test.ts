import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';
import { signAccessToken } from '../lib/tokens';

let userId: string;
let token: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: 'profile@test.jobtracker', password: 'hashed', name: 'Profile Tester' },
  });
  userId = user.id;
  token = signAccessToken(userId, user.email);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.jobtracker' } } });
  await prisma.$disconnect();
});

describe('POST /api/v1/profile/sync/:resumeId — experienceMerges', () => {
  it('overwrites the matched existing entry and appends new experiences', async () => {
    const existing = {
      company: 'Cafe', title: 'Full-Stack Website Developer', location: null,
      startDate: null, endDate: null, current: false,
      description: '• Built a website using TypeScript and Tailwind CSS',
    };
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, experience: [existing] },
      update: { experience: [existing], skills: [], education: [], certifications: [], syncedResumeIds: [] },
    });

    const resume = await prisma.resume.create({
      data: { userId, s3Key: `resumes/${userId}/m.pdf`, fileName: 'm.pdf', fileSize: 1, name: 'M' },
    });

    const merged = {
      company: 'Mermaid Sushi Cafe', title: 'Full-Stack Website For A Commercial Cafe', location: null,
      startDate: null, endDate: null, current: false,
      description: '• Designed and developed a production-grade bilingual website using Next.js, React, TypeScript, and Tailwind CSS',
    };
    const brandNew = {
      company: 'Acme', title: 'Engineer', location: null,
      startDate: null, endDate: null, current: false, description: '• Did things',
    };

    const res = await request(app)
      .post(`/api/v1/profile/sync/${resume.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        skills: [],
        education: [],
        certifications: [],
        experience: [brandNew],
        experienceMerges: [{ existingIndex: 0, merged }],
      });

    expect(res.status).toBe(200);
    const exp = res.body.data.experience as { title: string }[];
    expect(exp).toHaveLength(2);
    expect(exp[0].title).toBe('Full-Stack Website For A Commercial Cafe'); // overwritten in place
    expect(exp[1].title).toBe('Engineer'); // appended
  });

  it('ignores an out-of-range merge index without crashing', async () => {
    const resume = await prisma.resume.create({
      data: { userId, s3Key: `resumes/${userId}/m2.pdf`, fileName: 'm2.pdf', fileSize: 1, name: 'M2' },
    });
    const merged = {
      company: 'X', title: 'Y', location: null, startDate: null, endDate: null, current: false, description: '',
    };

    const res = await request(app)
      .post(`/api/v1/profile/sync/${resume.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skills: [], education: [], certifications: [], experience: [], experienceMerges: [{ existingIndex: 99, merged }] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
