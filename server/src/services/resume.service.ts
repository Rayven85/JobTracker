import { nanoid } from 'nanoid';
import { ExtractionStatus } from '@prisma/client';
import { PDFParse } from 'pdf-parse';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/AppError';
import { generatePresignedUploadUrl, deleteS3Object, getS3ObjectBuffer } from '../lib/s3';
import { extractProfileFromResume } from './ai.service';
import { computeResumeProfileDiff } from './profile.service';
import type { ConfirmUploadInput, UpdateExtractedDataInput } from '../validators/resume.validator';

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
    select: { id: true, name: true, fileName: true, fileSize: true, isDefault: true, extractionStatus: true, createdAt: true },
  });

  // Fire-and-forget — do not await
  extractAndSaveText(resume.id, input.s3Key);

  return resume;
}

export async function extractAndSaveText(resumeId: string, s3Key: string): Promise<void> {
  try {
    const buffer = await getS3ObjectBuffer(s3Key);
    const parser = new PDFParse({ data: buffer });
    let text: string;
    try {
      ({ text } = await parser.getText());
    } finally {
      await parser.destroy();
    }
    const hasText = text.trim().length > 0;
    await prisma.resume.update({
      where: { id: resumeId },
      data: { parsedText: text, extractionStatus: hasText ? ExtractionStatus.READY : ExtractionStatus.EMPTY },
    });
    if (hasText) {
      console.log(`[resume] PDF text extracted for ${resumeId} (${text.length} chars)`);
      extractAndSaveProfile(resumeId, text).catch(err =>
        console.error(`[resume] AI profile extraction failed for ${resumeId}:`, err)
      );
    } else {
      console.warn(`[resume] PDF extraction produced no text for ${resumeId} — likely a scanned/image-only PDF`);
    }
  } catch (err) {
    console.error(`[resume] PDF extraction failed for ${resumeId}:`, err);
    await prisma.resume
      .update({ where: { id: resumeId }, data: { extractionStatus: ExtractionStatus.FAILED } })
      .catch(e => console.error(`[resume] could not mark ${resumeId} as FAILED:`, e));
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
      extractionStatus: true,
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

export async function updateParsedText(resumeId: string, userId: string, parsedText: string) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  if (resume.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  const status = parsedText.trim().length > 0 ? ExtractionStatus.READY : ExtractionStatus.EMPTY;
  return prisma.resume.update({
    where: { id: resumeId },
    data: { parsedText, extractionStatus: status },
    select: { id: true, parsedText: true, extractionStatus: true },
  });
}

export async function updateExtractedData(resumeId: string, userId: string, data: UpdateExtractedDataInput) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  if (resume.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  const updated = await prisma.resume.update({
    where: { id: resumeId },
    data: { extractedData: data as object },
    select: { id: true, name: true, extractedData: true, extractionStatus: true },
  });

  const suggestion = await computeResumeProfileDiff(userId, resumeId);
  return { resume: updated, suggestion };
}

// Re-run AI extraction on an existing resume's parsedText, overwriting extractedData.
// Lets users apply prompt improvements without re-uploading. Returns {resume, suggestion}
// like updateExtractedData so the client can offer a profile sync.
export async function reExtractProfile(resumeId: string, userId: string) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  if (resume.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  if (!resume.parsedText || resume.parsedText.trim().length === 0) {
    throw new AppError(400, 'NO_PARSED_TEXT', 'This resume has no extracted text to analyze');
  }

  const extracted = await extractProfileFromResume(resume.parsedText);
  const updated = await prisma.resume.update({
    where: { id: resumeId },
    data: { extractedData: extracted as object },
    select: { id: true, name: true, extractedData: true, extractionStatus: true },
  });

  const suggestion = await computeResumeProfileDiff(userId, resumeId);
  return { resume: updated, suggestion };
}

async function extractAndSaveProfile(resumeId: string, parsedText: string): Promise<void> {
  const extracted = await extractProfileFromResume(parsedText);
  await prisma.resume.update({
    where: { id: resumeId },
    data: { extractedData: extracted as object },
  });
  console.log(`[resume] AI profile extracted for ${resumeId}`);
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
