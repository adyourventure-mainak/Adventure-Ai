import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma, creditBalance } from "@adventure/db";
import type { CompanyFoundation } from "@adventure/core";
import { requireUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { ActivityFeed } from "@/components/activity-feed";
import { RequestTask } from "@/components/request-task";
import { ForwardSupport } from "@/components/forward-support";
import { GmbReviews } from "@/components/gmb-reviews";

export const dynamic = "force-dynamic";

const TASK_BADGE: Record<string, string> = {
  PENDING: "queued",
  QUEUED: "queued",
  RUNNING: "running",
  AWAITING_APPROVAL: "needs approval",
  COMPLETED: "done",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const user = await requireUser();
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    include: {
      plan: true,
      landingPage: true,
      activityLogs: { orderBy: { createdAt: "desc" }, take: 20 },
      tasks: { orderBy: { createdAt: "desc" }, take: 8 },
      dailyBriefs: { orderBy: { date: "desc" }, take: 1 },
      subscription: true,
      provisions: true,
    },
  });
  if (!company || company.ownerId !== user.id) notFound();
  if (company.status === "DELETING") redirect("/dashboard?deleted=1");
  // Unpaid companies (legacy Free, or an expired trial) see only billing.
  const trialExpired =
    company.planTier === "TRIAL" && company.trialEndsAt && company.trialEndsAt < new Date();
  if (company.planTier === "FREE" || trialExpired) redirect(`/c/${company.slug}/billing`);

  const copy = (company.landingPage?.copy ?? null) as CompanyFoundation["landingCopy"] | null;
  const plan = (company.plan?.thirtyDayPlan ?? []) as CompanyFoundation["thirtyDayPlan"];
  const brief = company.dailyBriefs[0];
  const deployedUrl = company.landingPage?.deployedUrl;
  const repo = company.provisions.find((p) => p.resource === "GITHUB_REPO" && p.status === "DONE");
  const credits = await creditBalance(company.id);

  // Unread deliverables: inbox-bound tasks completed since the owner last opened the Inbox.
  const unreadCount = await prisma.task.count({
    where: {
      companyId: company.id,
      status: "COMPLETED",
      agent: { in: ["SOCIAL", "EMAIL_OUTREACH", "SUPPORT", "ADS"] },
      ...(company.inboxSeenAt ? { completedAt: { gt: company.inboxSeenAt } } : {}),
    },
  });

  const recentPosts = await prisma.task.findMany({
        where: { companyId: company.id, agent: "SOCIAL", status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 4,
        select: { id: true, completedAt: true, result: true },
      });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="mt-1 text-sm text-ink-400">{company.ideaSummary}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/c/${company.slug}/plan`}>
            <Badge variant="outline" className="cursor-pointer">Growth plan</Badge>
          </Link>
          <Link href={`/c/${company.slug}/inbox`}>
            <Badge
              variant={unreadCount > 0 ? "default" : "outline"}
              className={unreadCount > 0 ? "cursor-pointer bg-brand-500 text-ink-950" : "cursor-pointer"}
            >
              Inbox{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </Badge>
          </Link>
          <Link href={`/c/${company.slug}/billing`}>
            <Badge variant="outline" className="cursor-pointer">Billing &amp; settings</Badge>
          </Link>
          <Badge variant="outline">{credits} credits</Badge>
          <Badge variant={company.status === "ACTIVE" ? "success" : "outline"}>
            {company.status}
          </Badge>
        </div>
      </div>

      {(
        <Card className="flex flex-wrap items-center gap-4 py-4">
          {deployedUrl && (
            <a href={deployedUrl} target="_blank" className="text-sm text-brand-400 hover:underline">
              ↗ Live site: {deployedUrl.replace("https://", "")}
            </a>
          )}
          {repo && (
            <a
              href={`https://github.com/${repo.externalId}`}
              target="_blank"
              className="text-sm text-brand-400 hover:underline"
            >
              ↗ Your code: github.com/{repo.externalId}
            </a>
          )}
          <Link href={`/live/${company.slug}`} className="text-sm text-brand-400 hover:underline">
            ↗ Public feed
          </Link>
          <a
            href={`/api/companies/${company.slug}/export`}
            className="text-sm text-ink-400 hover:text-white hover:underline"
          >
            ⤓ Download your data
          </a>
        </Card>
      )}

      {brief && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Daily brief from your CEO agent</h2>
            <span className="text-xs text-ink-400">{brief.date.toISOString().slice(0, 10)}</span>
          </div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-100">
            {brief.content}
          </div>
        </Card>
      )}

      {(
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-semibold">Ask your agents</h2>
            <p className="mb-4 mt-1 text-sm text-ink-400">
              Request a site change from the Engineer, or a social post with a generated image
              from the Social agent. Runs beyond your included daily cycle, so it uses a credit.
            </p>
            <RequestTask slug={company.slug} />
          </Card>
          <Card>
            <h2 className="font-semibold">Forward to Support</h2>
            <p className="mb-4 mt-1 text-sm text-ink-400">
              Got a customer question? Your Support agent drafts the reply using company memory.
              Free — it&apos;s your company serving its customers.
            </p>
            <ForwardSupport slug={company.slug} />
          </Card>
        </div>
      )}

      <Card>
        <h2 className="font-semibold">Client reviews on your website</h2>
        <p className="mb-4 mt-1 text-sm text-ink-400">
          Paste your Google Business (GMB) link — we scan it, pull your top 3 ratings &amp;
          reviews, and publish a &quot;What our customers say&quot; section on your website.
        </p>
        <GmbReviews
          slug={company.slug}
          initialGmbUrl={company.gmbUrl}
          initialReviews={(company.reviews as { author: string; rating: number; text: string }[] | null) ?? []}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Positioning</h2>
          <p className="mt-3 text-sm text-ink-100">{company.positioning}</p>
          <h3 className="mt-6 text-sm font-semibold text-ink-400">Brand voice</h3>
          <p className="mt-1 text-sm text-ink-100">{company.brandVoice}</p>
        </Card>

        <Card>
          <h2 className="font-semibold">Tasks</h2>
          {company.tasks.length === 0 ? (
            <p className="mt-3 text-sm text-ink-400">
              No tasks yet — the Orchestrator dispatches them each cycle.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {company.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-ink-100">{t.title}</span>
                  <Badge
                    variant={
                      t.status === "COMPLETED" ? "success" : t.status === "FAILED" ? "default" : "outline"
                    }
                    className={t.status === "FAILED" ? "bg-red-500/15 text-red-400" : ""}
                  >
                    {TASK_BADGE[t.status] ?? t.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {recentPosts.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Social posts</h2>
            <Link href={`/c/${company.slug}/inbox`} className="text-sm text-brand-400 hover:underline">
              View all in Inbox →
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink-400">
            Ready to use — download the image and copy the caption, or share via the Inbox.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {recentPosts.map((t) => {
              const post = (t.result as { post?: { platform?: string; text?: string; hashtags?: string[]; imageUrl?: string } } | null)?.post;
              if (!post?.text) return null;
              return (
                <div key={t.id} className="rounded-lg border border-ink-800 p-4">
                  <div className="flex items-start gap-4">
                    {post.imageUrl && (
                      <div className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.imageUrl}
                          alt="Post image"
                          className="aspect-square w-28 rounded-lg border border-ink-800 object-cover"
                        />
                        <a
                          href={`${post.imageUrl}?download=post-image.jpg`}
                          className="mt-1 block text-center text-xs text-brand-400 hover:underline"
                        >
                          ⬇ Download
                        </a>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm text-ink-100">{post.text}</p>
                      {post.hashtags && post.hashtags.length > 0 && (
                        <p className="mt-2 flex flex-wrap gap-2">
                          {post.hashtags.map((h) => (
                            <span key={h} className="rounded-full border border-ink-800 px-2 py-0.5 text-xs text-ink-400">
                              #{h}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">30-day launch plan</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {plan.map((week) => (
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

      {copy && (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
            <h2 className="font-semibold">
              Landing page {company.landingPage?.version ? `(v${company.landingPage.version})` : ""}
            </h2>
            <Badge variant={deployedUrl ? "success" : "outline"}>
              {deployedUrl ? "deployed" : "preview"}
            </Badge>
          </div>
          <div className="rounded-b-xl bg-white px-8 py-14 text-center text-ink-950">
            <h1 className="mx-auto max-w-2xl text-4xl font-bold">{copy.heroHeadline}</h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink-600">{copy.heroSubheadline}</p>
            <span className="mt-6 inline-block rounded-lg bg-ink-950 px-6 py-3 font-medium text-white">
              {copy.cta}
            </span>
            <div className="mx-auto mt-12 grid max-w-3xl gap-6 text-left sm:grid-cols-3">
              {copy.features.map((f) => (
                <div key={f.title}>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-ink-600">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-0">
        <ActivityFeed
          slug={company.slug}
          initial={company.activityLogs.map((log) => ({
            id: log.id,
            agent: log.agent,
            action: log.action,
            createdAt: log.createdAt.toISOString(),
            tokens: log.inputTokens + log.outputTokens,
          }))}
        />
      </Card>
    </div>
  );
}
