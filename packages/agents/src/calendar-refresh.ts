import { prisma } from "@adventure/db";
import type { ContentCalendar } from "@adventure/core";
import { generateContentCalendar } from "./calendar";
import { logActivity } from "./activity";

interface CompanyForCalendar {
  id: string;
  name: string;
  ideaSummary: string | null;
  positioning: string | null;
  brandVoice: string | null;
  location: string | null;
  plan: { contentCalendar: unknown } | null;
}

/** A stored calendar is stale once its first planned day is in the past. */
export function calendarIsStale(calendar: ContentCalendar | null): boolean {
  if (!calendar || !calendar.days?.length) return true;
  const today = new Date().toISOString().slice(0, 10);
  return calendar.days[0].date < today;
}

/**
 * Regenerate the 3-day content calendar when the stored one has rolled out of
 * date (or doesn't exist). Persists onto CompanyPlan and logs the refresh.
 * Returns the calendar in use (fresh or still-current), or null if generation
 * failed upstream. `force` regenerates regardless of staleness.
 */
export async function refreshContentCalendar(
  company: CompanyForCalendar,
  opts: { force?: boolean } = {},
): Promise<ContentCalendar | null> {
  const current = (company.plan?.contentCalendar ?? null) as ContentCalendar | null;
  if (!opts.force && !calendarIsStale(current)) return current;

  const { calendar, usage } = await generateContentCalendar({
    companyName: company.name,
    ideaSummary: company.ideaSummary ?? "",
    positioning: company.positioning ?? "",
    brandVoice: company.brandVoice ?? "",
    location: company.location,
  });

  await prisma.companyPlan.upsert({
    where: { companyId: company.id },
    // thirtyDayPlan is required on create; an ACTIVE company always has a plan,
    // so create is just a defensive fallback.
    create: {
      companyId: company.id,
      thirtyDayPlan: [],
      contentCalendar: calendar as object,
      contentCalendarUpdatedAt: new Date(),
    },
    update: {
      contentCalendar: calendar as object,
      contentCalendarUpdatedAt: new Date(),
    },
  });

  await logActivity({
    companyId: company.id,
    agent: "PLANNER",
    action: `Refreshed the 3-day content calendar (${calendar.days.length} days, ${calendar.days.reduce((n, d) => n + d.posts.length, 0)} posts)`,
    usage,
    isPublic: false,
  });

  return calendar;
}
