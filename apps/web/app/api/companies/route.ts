import { NextResponse } from "next/server";
import { prisma, grantWelcomeCredits } from "@adventure/db";
import { CreateCompanyInput, companyLimitForOwner, PLANS, FREE_TRIAL_DAYS, socialProfileUrl } from "@adventure/core";
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
  const { idea, surprise, phone, phoneConsent, socialConsent } = parsed.data;
  if (!surprise && (!idea || idea.trim().length < 10)) {
    return NextResponse.json(
      { error: "Describe your idea in at least a sentence, or use Surprise me." },
      { status: 400 },
    );
  }

  // WhatsApp number is optional; the site's Call/WhatsApp buttons appear only
  // when one is given. Normalize to E.164-ish (digits + leading +).
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

  // Owners type just the account name/handle (or paste a URL) — build the link.
  const facebookUrl = socialProfileUrl(parsed.data.facebookUrl, "facebook");
  const instagramUrl = socialProfileUrl(parsed.data.instagramUrl, "instagram");
  const youtubeUrl = socialProfileUrl(parsed.data.youtubeUrl, "youtube");
  const linkedinUrl = socialProfileUrl(parsed.data.linkedinUrl, "linkedin");
  for (const [given, normalized, label] of [
    [parsed.data.facebookUrl, facebookUrl, "Facebook"],
    [parsed.data.instagramUrl, instagramUrl, "Instagram"],
    [parsed.data.youtubeUrl, youtubeUrl, "YouTube"],
    [parsed.data.linkedinUrl, linkedinUrl, "LinkedIn"],
  ] as const) {
    if (given?.trim() && !normalized) {
      return NextResponse.json(
        { error: `That doesn't look like a valid ${label} account name or URL.` },
        { status: 400 },
      );
    }
  }
  const hasSocials = Boolean(facebookUrl || instagramUrl || youtubeUrl || linkedinUrl);
  // DPDP: storing/displaying the social links requires explicit consent.
  if (hasSocials && !socialConsent) {
    return NextResponse.json(
      { error: "Please tick the consent box to store your social links, or leave them blank." },
      { status: 400 },
    );
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
      select: { planTier: true, theme: true },
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

  // Every company this owner creates must look different: if the generated
  // style (or font) repeats a sibling company's, rotate to an unused one.
  // 5 styles × distinct picks = 5 visibly different sites per owner.
  const STYLES = ["minimal", "bold", "playful", "elegant", "corporate"] as const;
  const FONTS = ["sans", "serif", "rounded", "mono"] as const;
  const siblingThemes = owned
    .map((c) => c.theme as { style?: string; fontFamily?: string } | null)
    .filter(Boolean);
  const usedStyles = new Set(siblingThemes.map((t) => t!.style));
  if (usedStyles.has(foundation.design.style)) {
    const free = STYLES.filter((s) => !usedStyles.has(s));
    if (free.length > 0) {
      foundation.design.style = free[Math.floor(Math.random() * free.length)];
      // Nudge the font too when the style rotated and the font also repeats.
      const usedFonts = new Set(siblingThemes.map((t) => t!.fontFamily));
      if (usedFonts.has(foundation.design.fontFamily)) {
        const freeFonts = FONTS.filter((f) => !usedFonts.has(f));
        if (freeFonts.length > 0) foundation.design.fontFamily = freeFonts[0];
      }
    }
  }

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
      facebookUrl,
      instagramUrl,
      youtubeUrl,
      linkedinUrl,
      socialConsentAt: hasSocials ? new Date() : null,
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
