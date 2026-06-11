import { Prisma, ApplicationStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/AppError';
import type { CreateApplicationInput, UpdateApplicationInput, UpdateStatusInput } from '../validators/application.validator';

async function checkOwnership(applicationId: string, userId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true, status: true },
  });
  if (!application) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (application.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  return application;
}

export async function listApplications(
  userId: string,
  { status, search, page = 1, limit = 20 }: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
) {
  const where: Prisma.ApplicationWhereInput = {
    userId,
    ...(status ? { status: status as ApplicationStatus } : {}),
    ...(search ? {
      OR: [
        { companyName: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        companyName: true,
        jobTitle: true,
        status: true,
        isRemote: true,
        location: true,
        matchScore: true,
        appliedDate: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        resume: { select: { id: true, name: true } },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      },
    }),
    prisma.application.count({ where }),
  ]);

  return {
    items: items.map(item => ({ ...item, tags: item.tags.map(t => t.tag) })),
    total,
    page,
    limit,
  };
}

export async function createApplication(userId: string, input: CreateApplicationInput) {
  if (input.resumeId) {
    const resume = await prisma.resume.findFirst({ where: { id: input.resumeId, userId } });
    if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  }

  return prisma.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: { ...input, userId },
    });
    await tx.applicationEvent.create({
      data: { applicationId: application.id, eventType: 'CREATED' },
    });
    return application;
  });
}

export async function getApplication(applicationId: string, userId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      companyName: true,
      jobTitle: true,
      jobDescription: true,
      jobUrl: true,
      location: true,
      salaryMin: true,
      salaryMax: true,
      employmentType: true,
      isRemote: true,
      status: true,
      appliedDate: true,
      deadline: true,
      matchScore: true,
      matchAnalysis: true,
      notes: true,
      resumeId: true,
      createdAt: true,
      updatedAt: true,
      resume: { select: { id: true, name: true, fileName: true } },
      coverLetters: {
        select: { id: true, version: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      interviewPrep: { select: { id: true, questions: true, generatedAt: true } },
      contacts: { select: { id: true, name: true, role: true, email: true, linkedinUrl: true, notes: true } },
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      events: {
        select: { id: true, eventType: true, oldStatus: true, newStatus: true, note: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!application) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (application.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  return { ...application, tags: application.tags.map(t => t.tag) };
}

export async function updateApplication(
  applicationId: string,
  userId: string,
  input: UpdateApplicationInput
) {
  await checkOwnership(applicationId, userId);

  if (input.resumeId) {
    const resume = await prisma.resume.findFirst({ where: { id: input.resumeId, userId } });
    if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  }

  return prisma.application.update({
    where: { id: applicationId },
    data: input,
  });
}

export async function updateStatus(
  applicationId: string,
  userId: string,
  input: UpdateStatusInput
) {
  const application = await checkOwnership(applicationId, userId);
  const oldStatus = application.status;
  const newStatus = input.status as ApplicationStatus;

  const [updated] = await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId },
      data: { status: newStatus },
    }),
    prisma.applicationEvent.create({
      data: {
        applicationId,
        eventType: 'STATUS_CHANGED',
        oldStatus,
        newStatus,
        ...(input.note ? { note: input.note } : {}),
      },
    }),
  ]);

  return updated;
}

export async function deleteApplication(applicationId: string, userId: string) {
  await checkOwnership(applicationId, userId);
  await prisma.application.delete({ where: { id: applicationId } });
}

export async function getEvents(applicationId: string, userId: string) {
  await checkOwnership(applicationId, userId);
  return prisma.applicationEvent.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addTag(applicationId: string, userId: string, tagId: string) {
  const [application, tag] = await Promise.all([
    prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, userId: true },
    }),
    prisma.tag.findUnique({
      where: { id: tagId },
      select: { id: true, userId: true },
    }),
  ]);

  if (!application) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (application.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  if (!tag || tag.userId !== userId) throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');

  await prisma.applicationTag.create({ data: { applicationId, tagId } });
}

export async function removeTag(applicationId: string, userId: string, tagId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true },
  });

  if (!application) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (application.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  await prisma.applicationTag.delete({
    where: { applicationId_tagId: { applicationId, tagId } },
  });
}
