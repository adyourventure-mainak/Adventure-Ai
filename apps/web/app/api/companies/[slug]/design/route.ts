import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import type { CompanyTheme } from "@adventure/core";
import { getUser } from "@/lib/auth";

const Input = z.object({
  suggestions: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
  imageUrls: z.array(z.string().url().startsWith("https://")).max(5).default([]),
});

/**
 * Save the owner's website design brief (up to 5 suggestions + uploaded
 * images) onto Company.theme and queue an Engineer rebuild that applies it.
 * Part of onboarding — free, no credit charge.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { suggestions, imageUrls } = parsed.data;
  if (suggestions.length === 0 && imageUrls.length === 0) {
    return NextResponse.json({ error: "Add at least one suggestion or image, or skip" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true, theme: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const theme = { ...((company.theme ?? {}) as CompanyTheme), suggestions, imageUrls };
  await prisma.$transaction([
    prisma.company.update({ where: { id: company.id }, data: { theme } }),
    prisma.task.create({
      data: {
        companyId: company.id,
        agent: "ENGINEER",
        type: "landing_page_edit",
        source: "ON_DEMAND",
        title: "Apply the owner's website design brief",
        status: "PENDING",
        payload: {
          instruction: `The owner shared design preferences for the website. Apply them:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n") || "(images only)"}`,
          imageUrls,
          requestedBy: user.email,
        },
      },
    }),
    prisma.activityLog.create({
      data: {
        companyId: company.id,
        agent: "ENGINEER",
        action: `Design brief received (${suggestions.length} suggestion(s), ${imageUrls.length} image(s)) — rebuilding the website`,
        isPublic: false,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
