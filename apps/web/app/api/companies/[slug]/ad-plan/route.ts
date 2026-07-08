import { NextResponse } from "next/server";
import { prisma } from "@adventure/db";
import { planAllows } from "@adventure/core";
import { generateAdPlan, logActivity } from "@adventure/agents";
import { getUser } from "@/lib/auth";

/**
 * Generate (or regenerate) the 30-day advertisement plan for a paid company.
 * Stored on CompanyPlan.adPlan; the /c/[slug]/plan page renders it.
 */
export async function POST(_request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      ownerId: true,
      planTier: true,
      ideaSummary: true,
      positioning: true,
      brandVoice: true,
      adBudgetCapP: true,
    },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (!planAllows(company.planTier, "AD_PLAN")) {
    return NextResponse.json(
      { error: "The 30-day ad plan is a paid feature — upgrade to unlock it." },
      { status: 403 },
    );
  }

  const { adPlan } = await generateAdPlan({
    companyName: company.name,
    ideaSummary: company.ideaSummary ?? "",
    positioning: company.positioning ?? "",
    brandVoice: company.brandVoice ?? "",
    adBudgetCapPaise: company.adBudgetCapP,
  });

  await prisma.companyPlan.update({
    where: { companyId: company.id },
    data: { adPlan: adPlan as object, adPlanUpdatedAt: new Date() },
  });
  await logActivity({
    companyId: company.id,
    agent: "ADS",
    action: "Drafted the 30-day advertisement plan with segment & competitor research",
  });

  return NextResponse.json({ ok: true });
}
