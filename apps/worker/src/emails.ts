import { prisma } from "@adventure/db";
import { mailer } from "@adventure/agents";

/**
 * Owner lifecycle emails, driven from the scheduler tick (idempotent, DB-gated):
 *
 *  - ACTIVE subscription → one activity-reminder email per day (staggered per
 *    company) with the daily brief, this week's plan tasks, and unread inbox count.
 *  - Subscription stopped (LAPSED company, or HALTED/CANCELLED/EXPIRED
 *    subscription) → reminders stop; one win-back email per week instead.
 *
 * Both no-op entirely when RESEND_API_KEY is unset.
 */
export async function sendLifecycleEmails() {
  if (!mailer.mailerConfigured()) return;
  const now = new Date();

  // 1. Daily activity reminders — paying/trial companies whose agents run.
  const active = await prisma.company.findMany({
    where: {
      status: "ACTIVE",
      planTier: { not: "FREE" },
      owner: { deletedAt: null },
      OR: [
        { subscription: null }, // trials have no subscription row yet
        { subscription: { status: { in: ["CREATED", "AUTHENTICATED", "ACTIVE"] } } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      inboxSeenAt: true,
      lastReminderEmailAt: true,
      owner: { select: { email: true } },
      plan: { select: { thirtyDayPlan: true } },
      dailyBriefs: { orderBy: { date: "desc" }, take: 1, select: { content: true } },
    },
    take: 200,
  });
  for (const c of active) {
    // One per day, staggered so sends spread across the clock.
    if (hash(c.id) % 24 !== now.getUTCHours()) continue;
    if (c.lastReminderEmailAt && now.getTime() - c.lastReminderEmailAt.getTime() < 20 * 3600_000)
      continue;
    try {
      const weeks = (c.plan?.thirtyDayPlan ?? []) as { week: number; title: string; tasks: string[] }[];
      const weekNo = Math.min(4, Math.floor((now.getTime() - c.createdAt.getTime()) / (7 * 86400_000)) + 1);
      const week = weeks.find((w) => w.week === weekNo) ?? weeks[0];
      const unreadCount = await prisma.task.count({
        where: {
          companyId: c.id,
          status: "COMPLETED",
          agent: { in: ["SOCIAL", "EMAIL_OUTREACH", "SUPPORT", "ADS"] },
          ...(c.inboxSeenAt ? { completedAt: { gt: c.inboxSeenAt } } : {}),
        },
      });
      const brief = c.dailyBriefs[0]?.content ?? null;
      const msg = mailer.activityReminderEmail({
        companyName: c.name,
        slug: c.slug,
        briefExcerpt: brief ? brief.slice(0, 300) : null,
        weekTitle: week?.title ?? null,
        weekTasks: week?.tasks?.slice(0, 5) ?? [],
        unreadCount,
      });
      await mailer.sendOwnerEmail({ to: c.owner.email, ...msg });
      await prisma.company.update({
        where: { id: c.id },
        data: { lastReminderEmailAt: now },
      });
      console.log(`[emails] activity reminder sent for ${c.slug}`);
    } catch (err) {
      console.error(`[emails] reminder failed for ${c.id}:`, err);
    }
  }

  // 2. Weekly win-back — subscription stopped, company data still retained.
  const lapsed = await prisma.company.findMany({
    where: {
      owner: { deletedAt: null },
      OR: [
        { status: "LAPSED" },
        { status: "PAUSED", subscription: { status: { in: ["HALTED", "CANCELLED", "EXPIRED"] } } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      lastWinbackEmailAt: true,
      owner: { select: { email: true } },
    },
    take: 200,
  });
  for (const c of lapsed) {
    if (c.lastWinbackEmailAt && now.getTime() - c.lastWinbackEmailAt.getTime() < 7 * 86400_000)
      continue;
    try {
      const msg = mailer.winbackEmail({ companyName: c.name, slug: c.slug });
      await mailer.sendOwnerEmail({ to: c.owner.email, ...msg });
      await prisma.company.update({
        where: { id: c.id },
        data: { lastWinbackEmailAt: now },
      });
      console.log(`[emails] win-back sent for ${c.slug}`);
    } catch (err) {
      console.error(`[emails] win-back failed for ${c.id}:`, err);
    }
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
