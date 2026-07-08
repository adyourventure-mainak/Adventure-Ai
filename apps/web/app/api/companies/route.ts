import { NextResponse } from "next/server";
import { prisma } from "@adventure/db";
import { CreateCompanyInput, companyLimitForOwner } from "@adventure/core";
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
  const { idea, surprise, phone } = parsed.data;
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
  }

  // Per-owner company cap, scaled by the best plan tier they hold
  // (Free 1, Pro/Trial 5, Scale 8).
  const owned = await prisma.company.findMany({
    where: { ownerId: user.id },
    select: { planTier: true },
  });
  const limit = companyLimitForOwner(owned.map((c) => c.planTier));
  if (owned.length >= limit) {
    return NextResponse.json(
      {
        error:
          limit >= 8
            ? "You've reached the maximum of 8 companies on the Scale plan."
            : limit >= 5
              ? "You've reached 5 companies. Upgrade a company to Scale to create up to 8."
              : "Free plan includes 1 company. Upgrade a company to Pro (5) or Scale (8) to create more.",
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

  const company = await prisma.company.create({
    data: {
      ownerId: user.id,
      name: foundation.companyName,
      slug: slugify(foundation.companyName),
      phone: normalizedPhone,
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
