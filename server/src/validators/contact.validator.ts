import { z } from 'zod';

export const createContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  role: z.string().nullish(),
  email: z.string().email('Invalid email').nullish(),
  linkedinUrl: z.string().url('Invalid URL').nullish(),
  notes: z.string().nullish(),
});

export const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().nullish(),
  email: z.string().email().nullish(),
  linkedinUrl: z.string().url().nullish(),
  notes: z.string().nullish(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
