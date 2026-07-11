import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { isGmbUrl, extractGmbReviews, logActivity } from "@adventure/agents";
import { getUser } from "@/lib/auth";

export const maxDuration = 120; // fetch Google page + LLM extraction

const Input = z.object({ gmbUrl: z.string().min(5).max(500) });

/**
 * Owner pastes their Google My Business / Maps link; we scan it, pull the top
 * 3 ratings & reviews, store them, and queue an Engineer rebuild so the
 * website gets a "What our customers say" section.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const gmbUrl = parsed.data.gmbUrl.trim();
  if (!isGmbUrl(gmbUrl)) {
    return NextResponse.json(
      { error: "That doesn't look like a Google Business / Google Maps link (e.g. maps.app.goo.gl/… or g.page/…)." },
      { status: 400 },
    );
  }

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true, name: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  let reviews;
  let usage;
  try {
    ({ reviews, usage } = await extractGmbReviews(gmbUrl));
  } catch (err) {
    console.error(`[reviews] GMB scan failed for ${company.id}:`, err);
    return NextResponse.json(
      { error: "Couldn't read that Google page. Make sure the link opens your public business profile and try again." },
      { status: 502 },
    );
  }
  if (reviews.length === 0) {
    return NextResponse.json(
      { error: "No reviews found on that page. Check the link shows your reviews publicly, or try the 'share' link from your Google Business profile." },
      { status: 422 },
    );
  }

  await prisma.$transaction([
    prisma.company.update({
      where: { id: company.id },
      data: { gmbUrl, reviews: reviews.map((r) => ({ ...r })) },
    }),
    prisma.task.create({
      data: {
        companyId: company.id,
        agent: "ENGINEER",
        type: "landing_page_edit",
        source: "ON_DEMAND",
        title: "Add Google reviews to the website",
        status: "PENDING",
        payload: {
          instruction:
            "The owner connected their Google Business profile. The site now has their top Google reviews available — republish so the new 'What our customers say' section goes live. Do not change any copy.",
          requestedBy: user.email,
        },
      },
    }),
  ]);
  await logActivity({
    companyId: company.id,
    agent: "ENGINEER",
    action: `Pulled top ${reviews.length} Google review(s) — adding them to the website`,
    isPublic: false,
    usage,
  });

  return NextResponse.json({ ok: true, reviews });
}
