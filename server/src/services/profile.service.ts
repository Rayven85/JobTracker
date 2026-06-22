import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/AppError';
import { extractProfileFromResume, detectExperienceMerges, type ExtractedProfile } from './ai.service';
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

// Diff a resume's extractedData against the user's profile (reuses computeSuggestions).
// Returns a ProfileSuggestion-shaped diff or null when nothing new. Used after a resume
// extractedData edit to decide whether to offer syncing into the profile.
export async function computeResumeProfileDiff(userId: string, resumeId: string) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    select: { id: true, userId: true, name: true, extractedData: true },
  });
  if (!resume || resume.userId !== userId || resume.extractedData === null) return null;

  const diff = computeSuggestions(profile, resume.extractedData as unknown as ExtractedProfile);
  if (!diff) return null;
  return { resumeId: resume.id, resumeName: resume.name, ...diff };
}

// Phase 2: returns the new-item diff for a resume AND AI-detected merges between the
// resume's new experiences and the profile's existing experiences (same role/project,
// different title). Runs the AI merge step only when there is something to compare.
export async function getSyncPlan(userId: string, resumeId: string) {
  const suggestion = await computeResumeProfileDiff(userId, resumeId);
  if (!suggestion) return { suggestion: null, merges: [], existingExperience: [] };

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const existingExperience = asArray(profile?.experience ?? []) as ExtractedProfile['experience'];

  const merges = await detectExperienceMerges(existingExperience, suggestion.newExperience);
  return { suggestion, merges, existingExperience };
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

  // Apply smart merges first: overwrite existing entries in place (by index), then append new ones.
  const experience = [...asArray(profile.experience)];
  for (const m of accepted.experienceMerges) {
    if (m.existingIndex >= 0 && m.existingIndex < experience.length) {
      experience[m.existingIndex] = m.merged;
    }
  }
  experience.push(...accepted.experience);

  const merged = {
    skills: [...new Set([...asArray(profile.skills) as string[], ...accepted.skills])],
    experience,
    education: [...asArray(profile.education), ...accepted.education],
    certifications: [...asArray(profile.certifications), ...accepted.certifications],
    syncedResumeIds: [...new Set([...asArray(profile.syncedResumeIds) as string[], resumeId])],
  };

  // reason: Prisma Json fields require casting through any when updating with typed arrays
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return prisma.userProfile.update({ where: { userId }, data: merged as any });
}

// "Build / rebuild from resumes": extract any not-yet-processed resumes, then re-offer
// EVERY resume's data as suggestions by clearing syncedResumeIds. This way, anything the
// user has since deleted from the profile re-appears as a suggestion (items already present
// are deduped away by computeSuggestions, so they won't show again).
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

  // Reset sync tracking so all resumes are re-evaluated against the current profile.
  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, syncedResumeIds: [] },
    update: { syncedResumeIds: [] },
  });

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
