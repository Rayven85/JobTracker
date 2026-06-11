import { ApplicationStatus, EventType } from '@prisma/client';
import { prisma } from '../lib/prisma';

const ALL_STATUSES: ApplicationStatus[] = [
  'WISHLIST', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN',
];

const ACTIVE_STATUSES: ApplicationStatus[] = [
  'WISHLIST', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER',
];

const RESPONDED_STATUSES: ApplicationStatus[] = [
  'SCREENING', 'INTERVIEW', 'OFFER',
];

export async function getStats(userId: string) {
  const [byStatus, respondedCount, nonWishlistCount] = await Promise.all([
    prisma.application.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    }),
    // Apps that reached SCREENING/INTERVIEW/OFFER (numerator for responseRate)
    prisma.application.count({
      where: {
        userId,
        events: {
          some: {
            eventType: EventType.STATUS_CHANGED,
            newStatus: { in: RESPONDED_STATUSES },
          },
        },
      },
    }),
    // Apps beyond WISHLIST (denominator for responseRate)
    prisma.application.count({
      where: { userId, status: { not: ApplicationStatus.WISHLIST } },
    }),
  ]);

  // Fill all 7 statuses (groupBy omits statuses with 0 count)
  const totals = Object.fromEntries(
    ALL_STATUSES.map(s => [s, byStatus.find(r => r.status === s)?._count ?? 0])
  ) as Record<ApplicationStatus, number>;

  const responseRate =
    nonWishlistCount > 0
      ? Math.round((respondedCount / nonWishlistCount) * 100) / 100
      : 0;

  const activeApplications = ACTIVE_STATUSES.reduce((sum, s) => sum + totals[s], 0);

  // avgDaysToResponse: (first SCREENING event - appliedDate) averaged across qualifying apps
  const screeningApps = await prisma.application.findMany({
    where: {
      userId,
      appliedDate: { not: null },
      events: {
        some: { eventType: EventType.STATUS_CHANGED, newStatus: ApplicationStatus.SCREENING },
      },
    },
    select: {
      appliedDate: true,
      events: {
        where: { eventType: EventType.STATUS_CHANGED, newStatus: ApplicationStatus.SCREENING },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  let avgDaysToResponse = 0;
  const daysList = screeningApps
    .filter(app => app.events.length > 0 && app.appliedDate)
    .map(app => {
      const ms = app.events[0].createdAt.getTime() - app.appliedDate!.getTime();
      return ms / (1000 * 60 * 60 * 24);
    });

  if (daysList.length > 0) {
    const avg = daysList.reduce((a, b) => a + b, 0) / daysList.length;
    avgDaysToResponse = Math.round(avg * 10) / 10;
  }

  return { totals, responseRate, avgDaysToResponse, activeApplications };
}

export async function getRecentActivity(userId: string) {
  return prisma.applicationEvent.findMany({
    where: { application: { userId } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      eventType: true,
      createdAt: true,
      note: true,
      application: {
        select: { id: true, companyName: true, jobTitle: true },
      },
    },
  });
}
