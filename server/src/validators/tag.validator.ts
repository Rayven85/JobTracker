import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex color (e.g. #6366f1)').default('#6366f1'),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
