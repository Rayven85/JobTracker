import { prisma } from '../lib/prisma';
import { AppError } from '../lib/AppError';
import type { CreateTagInput } from '../validators/tag.validator';

export async function listTags(userId: string) {
  return prisma.tag.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
}

export async function createTag(userId: string, input: CreateTagInput) {
  const existing = await prisma.tag.findFirst({ where: { userId, name: input.name } });
  if (existing) throw new AppError(409, 'TAG_EXISTS', 'A tag with this name already exists');

  return prisma.tag.create({
    data: { ...input, userId },
  });
}

export async function deleteTag(tagId: string, userId: string) {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');
  if (tag.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  await prisma.tag.delete({ where: { id: tagId } });
}
