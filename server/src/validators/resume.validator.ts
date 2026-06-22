import { z } from 'zod';
import { educationSchema, experienceSchema, certificationSchema } from './profile.validator';

export const presignedUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  contentType: z.string().min(1, 'Content type is required'),
});

export const confirmUploadSchema = z.object({
  s3Key: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive('File size must be positive'),
  name: z.string().min(1, 'Resume name is required'),
});

export const updateResumeSchema = z.object({
  name: z.string().min(1, 'Resume name is required'),
});

export const updateParsedTextSchema = z.object({
  parsedText: z.string(),
});

export const updateExtractedDataSchema = z.object({
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

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
export type UpdateParsedTextInput = z.infer<typeof updateParsedTextSchema>;
export type UpdateExtractedDataInput = z.infer<typeof updateExtractedDataSchema>;
