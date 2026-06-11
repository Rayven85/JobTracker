import { z } from 'zod';

export const coverLetterRequestSchema = z.object({
  tone: z.string().optional(),
});

export const updateCoverLetterSchema = z.object({
  content: z.string().min(1, 'Content is required'),
});

export type CoverLetterRequestInput = z.infer<typeof coverLetterRequestSchema>;
export type UpdateCoverLetterInput = z.infer<typeof updateCoverLetterSchema>;
