import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/AppError';
import { extractProfileFromResume, type ExtractedProfile } from './ai.service';
import type { UpdateProfileInput, SyncResumeInput } from '../validators/profile.validator';

function toLower(s: string) { return s.toLowerCase().trim(); }

type ProfileShape = {
  skills: Prisma.JsonValue;
  education: Prisma.JsonValue;
  experience: Prisma.JsonValue;
  certifications: Prisma.JsonValue;
};

function asArray(v: Prisma.JsonValue): unknown[] {
  return Array.isArray(v) ? v : [];
}

function computeSuggestions(profile: ProfileShape, extracted: ExtractedProfile) {
  const currentSkills = new Set(asArray(profile.skills).map(s => toLower(s as string)));
  const newSkills = extracted.skills.filter(s => !currentSkills.has(toLower(s)));

  const currentExp = new Set(
    asArray(profile.experience).map(e => {
      const x = e as { company: string; title: string };
      return `${toLower(x.company)}|${toLower(x.title)}`;
    })
  );
  const newExperience = extracted.experience.filter(
    e => !currentExp.has(`${toLower(e.company)}|${toLower(e.title)}`)
  );

  const currentEdu = new Set(
    asArray(profile.education).map(e => {
      const x = e as { institution: string; degree: string };
      return `${toLower(x.institution)}|${toLower(x.degree)}`;
    })
  );
  const newEducation = extracted.education.filter(
    e => !currentEdu.has(`${toLower(e.institution)}|${toLower(e.degree)}`)
  );

  const currentCerts = new Set(
    asArray(profile.certifications).map(c => toLower((c as { name: string }).name))
  );
  const newCertifications = extracted.certifications.filter(
    c => !currentCerts.has(toLower(c.name))
  );

  if (!newSkills.length && !newExperience.length && !newEducation.length && !newCertifications.length) {
    return null;
  }
  return { newSkills, newExperience, newEducation, newCertifications };
}

export async function getProfile(userId: string) {
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const syncedIds = asArray(profile.syncedResumeIds) as string[];

  const unsyncedResumes = await prisma.resume.findMany({
    where: { userId, id: { notIn: syncedIds } },
    select: { id: true, name: true, extractedData: true },
    orderBy: { updatedAt: 'desc' },
  });

  const suggestions = unsyncedResumes
    .filter(r => r.extractedData !== null)
    .map(r => {
      const diff = computeSuggestions(profile, r.extractedData as unknown as ExtractedProfile);
      if (!diff) return null;
      return { resumeId: r.id, resumeName: r.name, ...diff };
    })
    .filter(Boolean);

  return { ...profile, suggestions };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return prisma.userProfile.upsert({
    where: { userId },
    // reason: Prisma Json fields require casting through any when spreading typed objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { userId, ...(input as any) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: input as any,
  });
}

export async function syncResume(userId: string, resumeId: string, accepted: SyncResumeInput) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  if (resume.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  const merged = {
    skills: [...new Set([...asArray(profile.skills) as string[], ...accepted.skills])],
    experience: [...asArray(profile.experience), ...accepted.experience],
    education: [...asArray(profile.education), ...accepted.education],
    certifications: [...asArray(profile.certifications), ...accepted.certifications],
    syncedResumeIds: [...new Set([...asArray(profile.syncedResumeIds) as string[], resumeId])],
  };

  // reason: Prisma Json fields require casting through any when updating with typed arrays
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return prisma.userProfile.update({ where: { userId }, data: merged as any });
}

// Runs AI extraction on all resumes that have parsedText but no extractedData yet
export async function buildProfileFromResumes(userId: string) {
  // Fetch all READY resumes, then filter in JS — avoids Prisma.AnyNull behaviour with the pg adapter
  const allReady = await prisma.resume.findMany({
    where: { userId, extractionStatus: 'READY' },
    select: { id: true, parsedText: true, extractedData: true },
  });
  const unprocessed = allReady.filter(r => r.extractedData === null);

  for (const resume of unprocessed) {
    if (!resume.parsedText) continue;
    try {
      const extracted = await extractProfileFromResume(resume.parsedText);
      await prisma.resume.update({
        where: { id: resume.id },
        // reason: Prisma Json field requires object cast
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { extractedData: extracted as any },
      });
    } catch (err) {
      console.error(`[profile] build failed for resume ${resume.id}:`, err);
    }
  }

  return getProfile(userId);
}

export async function dismissResumeSuggestions(userId: string, resumeId: string) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found');
  if (resume.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  const syncedResumeIds = [...new Set([...asArray(profile.syncedResumeIds) as string[], resumeId])];
  return prisma.userProfile.update({ where: { userId }, data: { syncedResumeIds } });
}
