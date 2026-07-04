import { NextResponse } from "next/server";
import { prisma } from "@adventure/db";
import { CreateCompanyInput } from "@adventure/core";
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
  const { idea, surprise } = parsed.data;
  if (!surprise && (!idea || idea.trim().length < 10)) {
    return NextResponse.json(
      { error: "Describe your idea in at least a sentence, or use Surprise me." },
      { status: 400 },
    );
  }

  // Free tier: 1 draft company per user.
  const existing = await prisma.company.count({
    where: { ownerId: user.id, planTier: "FREE" },
  });
  if (existing >= 1) {
    return NextResponse.json(
      { error: "Free plan includes 1 company. Upgrade an existing company to create more." },
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
      ideaSummary: foundation.ideaSummary,
      positioning: foundation.positioning,
      brandVoice: foundation.brandVoice,
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
