import { z } from 'zod';

const educationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().nullable().optional(),
  startYear: z.number().int().nullable().optional(),
  endYear: z.number().int().nullable().optional(),
});

const experienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  current: z.boolean().optional(),
  description: z.string().optional(),
});

const certificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  skills: z.array(z.string()).optional(),
  education: z.array(educationSchema).optional(),
  experience: z.array(experienceSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
});

export const syncResumeSchema = z.object({
  skills: z.array(z.string()).default([]),
  education: z.array(educationSchema).default([]),
  experience: z.array(experienceSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SyncResumeInput = z.infer<typeof syncResumeSchema>;
