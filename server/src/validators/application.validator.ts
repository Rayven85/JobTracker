import { z } from 'zod';

const statusEnum = z.enum(['WISHLIST', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']);
const employmentTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'GRADUATE']);

export const createApplicationSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  jobDescription: z.string().min(1, 'Job description is required'),
  jobUrl: z.string().url('Invalid URL').nullish(),
  resumeId: z.string().uuid().nullish(),
  location: z.string().nullish(),
  employmentType: employmentTypeEnum.nullish(),
  isRemote: z.boolean().default(false),
  appliedDate: z.coerce.date().nullish(),
  deadline: z.coerce.date().nullish(),
  salaryMin: z.number().int().min(0).nullish(),
  salaryMax: z.number().int().min(0).nullish(),
  status: statusEnum.default('WISHLIST'),
  notes: z.string().nullish(),
});

export const updateApplicationSchema = z.object({
  companyName: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  jobDescription: z.string().min(1).optional(),
  jobUrl: z.string().url().nullish(),
  resumeId: z.string().uuid().nullish(),
  location: z.string().nullish(),
  employmentType: employmentTypeEnum.nullish(),
  isRemote: z.boolean().optional(),
  appliedDate: z.coerce.date().nullish(),
  deadline: z.coerce.date().nullish(),
  salaryMin: z.number().int().min(0).nullish(),
  salaryMax: z.number().int().min(0).nullish(),
  notes: z.string().nullish(),
});

export const updateStatusSchema = z.object({
  status: statusEnum,
  note: z.string().optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
