import { z } from 'zod';

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

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
export type UpdateParsedTextInput = z.infer<typeof updateParsedTextSchema>;
