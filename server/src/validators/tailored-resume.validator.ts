import { z } from 'zod';
import { educationSchema, experienceSchema, certificationSchema } from './profile.validator';

// Structured edits to a generated tailored resume — same shape as ExtractedProfile / a resume's
// extracted data, so it round-trips through the shared ExtractedDataEditor.
export const updateTailoredResumeSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  skills: z.array(z.string()).default([]),
  education: z.array(educationSchema).default([]),
  experience: z.array(experienceSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
});

export type UpdateTailoredResumeInput = z.infer<typeof updateTailoredResumeSchema>;
