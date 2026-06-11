import { prisma } from '../lib/prisma';
import { AppError } from '../lib/AppError';
import type { CreateContactInput, UpdateContactInput } from '../validators/contact.validator';

export async function createContact(
  applicationId: string,
  userId: string,
  input: CreateContactInput
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true },
  });
  if (!application) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  if (application.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  return prisma.contact.create({
    data: { ...input, applicationId, userId },
  });
}

export async function updateContact(
  contactId: string,
  userId: string,
  input: UpdateContactInput
) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found');
  if (contact.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  return prisma.contact.update({
    where: { id: contactId },
    data: input,
  });
}

export async function deleteContact(contactId: string, userId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found');
  if (contact.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Access denied');

  await prisma.contact.delete({ where: { id: contactId } });
}
