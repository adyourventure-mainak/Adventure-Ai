import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@adventure/db";
import { planAllows, type AdPlan, type CompanyFoundation, type ContentCalendar } from "@adventure/core";
import { requireUser } from "@/lib/auth";
import { Badge, Button, Card } from "@/components/ui";
import { GenerateAdPlanButton } from "./generate-button";
import { ContentCalendarButton } from "./calendar-button";

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  twitter: "X",
};

function weekday(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export const dynamic = "force-dynamic";

export default async function GrowthPlanPage({ params }: { params: { slug: string } }) {
  const user = await requireUser();
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    include: { plan: true },
  });
  if (!company || company.ownerId !== user.id) notFound();

  const launchPlan = (company.plan?.thirtyDayPlan ?? []) as CompanyFoundation["thirtyDayPlan"];
  const adPlan = company.plan?.adPlan as AdPlan | null;
  const calendar = company.plan?.contentCalendar as ContentCalendar | null;
  const paid = planAllows(company.planTier, "AD_PLAN");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Growth plan — {company.name}</h1>
          <p className="mt-1 text-sm text-ink-400">
            The 30-day launch plan plus, on paid plans, a 30-day advertisement plan with
            segment and competitor research.
          </p>
        </div>
        <Link href={`/c/${company.slug}`}>
          <Button variant="outline" size="sm">Back to company</Button>
        </Link>
      </div>

      <Card>
        <h2 className="font-semibold">30-day launch plan</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {launchPlan.map((week) => (
            <div key={week.week}>
              <h3 className="text-sm font-semibold text-brand-400">
                Week {week.week}: {week.title}
              </h3>
              <ul className="mt-1 list-inside list-disc text-sm text-ink-100">
                {week.tasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">3-day content calendar</h2>
            <p className="mt-1 text-sm text-ink-400">
              Ready-to-post ideas for the next 3 days — tied to festivals, seasonality and your
              industry. It rolls forward automatically each day.
            </p>
          </div>
          <ContentCalendarButton slug={company.slug} regenerate={Boolean(calendar)} />
        </div>

        {!calendar ? (
          <p className="mt-4 text-sm text-ink-400">
            Not generated yet — click above, or wait for the next daily cycle.
          </p>
        ) : (
          <>
            {calendar.trendNote && (
              <p className="mt-4 rounded-lg border border-ink-800 bg-ink-950/50 px-3 py-2 text-xs text-ink-400">
                💡 {calendar.trendNote}
              </p>
            )}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {calendar.days.map((day) => (
                <div key={day.date} className="rounded-lg border border-ink-800 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-brand-400">{weekday(day.date)}</h3>
                  </div>
                  {day.occasion && day.occasion.toLowerCase() !== "none" && (
                    <p className="mt-1 text-xs font-medium text-ink-100">🎉 {day.occasion}</p>
                  )}
                  <div className="mt-3 space-y-3">
                    {day.posts.map((post, i) => (
                      <div key={i} className="rounded-md border border-ink-800/70 bg-ink-950/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {PLATFORM_LABEL[post.platform] ?? post.platform}
                          </Badge>
                          <span className="text-[10px] uppercase tracking-wide text-ink-400">{post.format}</span>
                          <span className="ml-auto text-[10px] text-ink-400">{post.bestTime}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-ink-100">{post.theme}</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-ink-300">{post.caption}</p>
                        {post.hashtags.length > 0 && (
                          <p className="mt-2 flex flex-wrap gap-1">
                            {post.hashtags.map((h) => (
                              <span key={h} className="text-[10px] text-brand-400">#{h}</span>
                            ))}
                          </p>
                        )}
                        {post.trendTieIn && post.trendTieIn.toLowerCase() !== "evergreen" && (
                          <p className="mt-2 text-[10px] text-ink-400">↳ {post.trendTieIn}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {company.plan?.contentCalendarUpdatedAt && (
              <p className="mt-3 text-xs text-ink-400">
                Updated {company.plan.contentCalendarUpdatedAt.toLocaleDateString("en-IN")}
              </p>
            )}
          </>
        )}
      </Card>

      {!paid ? (
        <Card className="border-brand-500">
          <h2 className="font-semibold">30-day advertisement plan</h2>
          <p className="mt-2 text-sm text-ink-400">
            Audience segments, a competitor teardown with counter-angles, and a week-by-week ad
            calendar — generated for your business. Available on Trial, Pro and Scale.
          </p>
          <Link href={`/c/${company.slug}/billing`} className="mt-4 inline-block">
            <Button>Upgrade to unlock</Button>
          </Link>
        </Card>
      ) : !adPlan ? (
        <Card>
          <h2 className="font-semibold">30-day advertisement plan</h2>
          <p className="mt-2 text-sm text-ink-400">
            Not generated yet. The AI researches your audience segments and competitors, then
            drafts a week-by-week ad calendar with budget splits and KPIs.
          </p>
          <div className="mt-4">
            <GenerateAdPlanButton slug={company.slug} regenerate={false} />
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">30-day advertisement plan</h2>
                <p className="mt-1 text-sm text-ink-400">{adPlan.objective}</p>
                {company.plan?.adPlanUpdatedAt && (
                  <p className="mt-1 text-xs text-ink-400">
                    Updated {company.plan.adPlanUpdatedAt.toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>
              <GenerateAdPlanButton slug={company.slug} regenerate />
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold">Audience segments</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {adPlan.segments.map((s) => (
                <div key={s.name} className="rounded-lg border border-ink-800 p-4">
                  <h3 className="text-sm font-semibold text-brand-400">{s.name}</h3>
                  <p className="mt-1 text-sm text-ink-100">{s.description}</p>
                  <p className="mt-2 text-xs font-semibold text-ink-400">Pain points</p>
                  <ul className="list-inside list-disc text-sm text-ink-100">
                    {s.painPoints.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.channels.map((c) => (
                      <Badge key={c} variant="outline">{c}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold">Competitor research</h2>
            <div className="mt-4 space-y-4">
              {adPlan.competitors.map((c) => (
                <div key={c.name} className="rounded-lg border border-ink-800 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">{c.name}</h3>
                    <p className="text-xs text-ink-400">{c.positioning}</p>
                  </div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-green-400">Strengths</p>
                      <ul className="list-inside list-disc text-ink-100">
                        {c.strengths.map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-red-400">Weaknesses</p>
                      <ul className="list-inside list-disc text-ink-100">
                        {c.weaknesses.map((w) => <li key={w}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-brand-400">Our angle: {c.counterAngle}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold">Ad calendar</h2>
            <div className="mt-4 space-y-5">
              {adPlan.calendar.map((week) => (
                <div key={week.week}>
                  <h3 className="text-sm font-semibold text-brand-400">
                    Week {week.week}: {week.theme}
                  </h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-ink-400">
                        <tr>
                          <th className="py-1 pr-4">Days</th>
                          <th className="py-1 pr-4">Channel</th>
                          <th className="py-1 pr-4">Segment</th>
                          <th className="py-1 pr-4">Concept</th>
                          <th className="py-1 pr-4">CTA</th>
                          <th className="py-1">Budget</th>
                        </tr>
                      </thead>
                      <tbody className="text-ink-100">
                        {week.entries.map((e, i) => (
                          <tr key={i} className="border-t border-ink-800">
                            <td className="py-2 pr-4 whitespace-nowrap">{e.days}</td>
                            <td className="py-2 pr-4">{e.channel}</td>
                            <td className="py-2 pr-4">{e.segment}</td>
                            <td className="py-2 pr-4">{e.concept}</td>
                            <td className="py-2 pr-4">{e.cta}</td>
                            <td className="py-2 whitespace-nowrap">{e.budgetPercent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold">KPIs & budget</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {adPlan.kpis.map((k) => (
                <div key={k.metric} className="rounded-lg border border-ink-800 p-3">
                  <p className="text-xs text-ink-400">{k.metric}</p>
                  <p className="text-sm font-semibold">{k.target}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-ink-400">{adPlan.budgetNote}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
