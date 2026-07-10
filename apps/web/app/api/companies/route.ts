import { NextResponse } from "next/server";
import { prisma, grantWelcomeCredits } from "@adventure/db";
import { CreateCompanyInput, companyLimitForOwner, PLANS, FREE_TRIAL_DAYS } from "@adventure/core";
import { generateCompanyFoundation, slugify, logActivity } from "@adventure/agents";
import { getUser } from "@/lib/auth";

export const maxDuration = 300; // company generation is a long LLM call

const AGENTS = [
  "ORCHESTRATOR",
  "PLANNER",
  "ENGINEER",
  "SOCIAL",
  "EMAIL_OUTREACH",
  "SUPPORT",
  "ADS",
  "FINANCE",
  "RESEARCH",
] as const;

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = CreateCompanyInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { idea, surprise, phone, phoneConsent } = parsed.data;
  if (!surprise && (!idea || idea.trim().length < 10)) {
    return NextResponse.json(
      { error: "Describe your idea in at least a sentence, or use Surprise me." },
      { status: 400 },
    );
  }

  // Normalize the WhatsApp number to E.164-ish (digits + leading +).
  let normalizedPhone: string | null = null;
  if (phone && phone.trim()) {
    const digits = phone.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length < 8) {
      return NextResponse.json({ error: "Enter a valid WhatsApp number with country code." }, { status: 400 });
    }
    normalizedPhone = digits.startsWith("+") ? digits : `+${digits}`;
    // DPDP: storing/displaying the number requires explicit consent.
    if (!phoneConsent) {
      return NextResponse.json(
        { error: "Please tick the consent box to store your WhatsApp number, or leave it blank." },
        { status: 400 },
      );
    }
  }

  // Per-owner cap: 5 company slots per month. Live companies (including ones
  // mid-deletion) occupy a slot, and deleting a company does NOT free its
  // slot until the next month starts — the tombstone ledger keeps it counted.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [owned, deletedThisMonth] = await Promise.all([
    prisma.company.findMany({
      where: { ownerId: user.id },
      select: { planTier: true },
    }),
    prisma.deletedCompanySlot.count({
      where: { ownerId: user.id, deletedAt: { gte: monthStart } },
    }),
  ]);
  const limit = companyLimitForOwner(owned.map((c) => c.planTier));
  if (owned.length + deletedThisMonth >= limit) {
    return NextResponse.json(
      {
        error:
          deletedThisMonth > 0
            ? "All 5 company slots for this month are used (deleted companies keep their slot until next month). Try again next month, or use a new subscription."
            : limit >= 5
              ? "You've reached the maximum of 5 companies for this month's subscription."
              : "Your plan includes 1 company. Upgrade to create up to 5 per month.",
      },
      { status: 403 },
    );
  }

  let result;
  try {
    result = await generateCompanyFoundation({ idea, surprise });
  } catch (err) {
    console.error("[companies] generation failed:", err);
    return NextResponse.json(
      { error: "The AI could not generate your company right now. Please try again." },
      { status: 502 },
    );
  }
  const { foundation, usage } = result;

  // Every new company starts a 2-day free trial: full Pro-level access, the
  // worker's scheduler lapses it via trialEndsAt, then billing takes over.
  const company = await prisma.company.create({
    data: {
      ownerId: user.id,
      planTier: "TRIAL",
      status: "PROVISIONING",
      taskCyclesPerDay: PLANS.TRIAL.taskCyclesPerDay,
      trialEndsAt: new Date(Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000),
      name: foundation.companyName,
      slug: slugify(foundation.companyName),
      phone: normalizedPhone,
      phoneConsentAt: normalizedPhone ? new Date() : null,
      ideaSummary: foundation.ideaSummary,
      positioning: foundation.positioning,
      brandVoice: foundation.brandVoice,
      theme: foundation.design,
      plan: { create: { thirtyDayPlan: foundation.thirtyDayPlan } },
      landingPage: { create: { copy: foundation.landingCopy } },
      agentStates: {
        create: AGENTS.map((agent) => ({ agent, enabled: false })),
      },
    },
    select: { id: true, slug: true },
  });

  await grantWelcomeCredits(company.id);
  await logActivity({
    companyId: company.id,
    agent: "FINANCE",
    action: `Your ${FREE_TRIAL_DAYS}-day free trial has started — everything is unlocked`,
    isPublic: false,
  });
  await logActivity({
    companyId: company.id,
    agent: "ORCHESTRATOR",
    action: surprise
      ? `Invented and validated a niche idea, founded "${foundation.companyName}"`
      : `Founded "${foundation.companyName}" from your idea`,
    detail: { tagline: foundation.tagline },
    usage,
  });
  await logActivity({
    companyId: company.id,
    agent: "PLANNER",
    action: "Drafted the 30-day launch plan",
  });
  await logActivity({
    companyId: company.id,
    agent: "ENGINEER",
    action: "Generated landing page copy — preview available (deploys on Pro)",
  });

  return NextResponse.json({ slug: company.slug });
}
