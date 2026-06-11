import { nanoid } from 'nanoid';
// reason: pdf-parse is CJS-only; esModuleInterop default import doesn't resolve its call signature
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/AppError';
import { generatePresignedUploadUrl, deleteS3Object, getS3ObjectBuffer } from '../lib/s3';
import type { ConfirmUploadInput } from '../validators/resume.validator';

export async function getPresignedUrl(userId: string, fileName: string, contentType: string) {
  if (contentType !== 'application/pdf') {
    throw new AppError(400, 'INVALID_CONTENT_TYPE', 'Only PDF files are supported');
  }
  const s3Key = `resumes/${userId}/${nanoid()}.pdf`;
  const presignedUrl = await generatePresignedUploadUrl(s3Key, contentType);
  return { presignedUrl, s3Key };
}

export async function confirmUpload(userId: string, input: ConfirmUploadInput) {
  const resume = await prisma.resume.create({
    data: {
      userId,
      s3Key: input.s3Key,
      fileName: input.fileName,
      fileSize: input.fileSize,
      name: input.name,
    },
    select: { id: true, name: true, fileName: true, fileSize: true, isDefault: true, createdAt: true },
  });

  // Fire-and-forget — do not await
  extractAndSaveText(resume.id, input.s3Key);

  return resume;
}

export async function extractAndSaveText(resumeId: string, s3Key: string): Promise<void> {
  try {
    const buffer = await getS3ObjectBuffer(s3Key);
    const { text } = await pdfParse(buffer);
    await prisma.resume.update({
      where: { id: resumeId },
      data: { parsedText: text },
    });
  } catch (err) {
    console.error(`[resume] PDF extraction failed for ${resumeId}:`, err);
  }
}

export async function listResumes(userId: string) {
  const resumes = await prisma.resume.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      fileName: true,
      fileSize: true,
      isDefault: true,
      parsedText: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return resumes.map(({ parsedText, ...r }) => ({
    ...r,
    parsedTextPreview: parsedText ? parsedText.slice(0, 200) : null,
  }));
}

export async function getResume(resumeId: string, userId: string) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  if (resume.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  return resume;
}

export async function updateResume(resumeId: string, userId: string, name: string) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  if (resume.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  return prisma.resume.update({
    where: { id: resumeId },
    data: { name },
  });
}

export async function deleteResume(resumeId: string, userId: string) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  if (resume.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  await prisma.resume.delete({ where: { id: resumeId } });
  await deleteS3Object(resume.s3Key);
}

export async function setDefault(resumeId: string, userId: string) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  if (resume.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  return prisma.$transaction(async (tx) => {
    await tx.resume.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.resume.update({ where: { id: resumeId }, data: { isDefault: true } });
  });
}
