import { NextResponse } from "next/server";
import { prisma } from "@adventure/db";
import { refreshContentCalendar } from "@adventure/agents";
import { getUser } from "@/lib/auth";

export const maxDuration = 120;

/**
 * Regenerate the rolling 3-day content calendar on demand. Stored on
 * CompanyPlan.contentCalendar; the /c/[slug]/plan page renders it. The daily
 * cycle also refreshes it automatically when it rolls out of date.
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
      ideaSummary: true,
      positioning: true,
      brandVoice: true,
      location: true,
      plan: { select: { contentCalendar: true } },
    },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  try {
    await refreshContentCalendar(company, { force: true });
  } catch (err) {
    console.error(`[content-calendar] generation failed for ${company.id}:`, err);
    return NextResponse.json(
      { error: "Couldn't build the calendar right now. Please try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
