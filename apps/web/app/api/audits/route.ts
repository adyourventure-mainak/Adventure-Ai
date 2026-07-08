import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { fetchWebsiteText, generateBusinessAudit } from "@adventure/agents";
import { getUser } from "@/lib/auth";

export const maxDuration = 300; // audit generation is a long LLM call

const Input = z.object({
  websiteUrl: z.string().url().max(500),
  businessName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

/** Reject non-http(s) URLs and obvious internal targets before fetching. */
function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) return false; // IP literals
    return true;
  } catch {
    return false;
  }
}

/** List the caller's audits (newest first, reports included). */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const audits = await prisma.businessAudit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, websiteUrl: true, businessName: true, status: true, createdAt: true },
  });
  return NextResponse.json({ audits });
}

/**
 * Request a business audit for an existing business: market research, SWOT,
 * product/service scope, and a growth implementation plan grounded in the
 * business's own website content.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid website URL (https://…)" }, { status: 400 });
  }
  const { websiteUrl, businessName, notes } = parsed.data;
  if (!isSafeUrl(websiteUrl)) {
    return NextResponse.json({ error: "That URL can't be audited" }, { status: 400 });
  }

  // Light abuse guard: 5 audits per day per user.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.businessAudit.count({
    where: { userId: user.id, createdAt: { gte: since } },
  });
  if (recent >= 5) {
    return NextResponse.json({ error: "Daily audit limit reached — try again tomorrow" }, { status: 429 });
  }

  const audit = await prisma.businessAudit.create({
    data: { userId: user.id, websiteUrl, businessName, notes, status: "PENDING" },
  });

  try {
    const websiteText = await fetchWebsiteText(websiteUrl);
    const { report } = await generateBusinessAudit({ websiteUrl, websiteText, businessName, notes });
    await prisma.businessAudit.update({
      where: { id: audit.id },
      data: { status: "READY", report: report as object },
    });
    return NextResponse.json({ id: audit.id, status: "READY" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit failed";
    await prisma.businessAudit.update({
      where: { id: audit.id },
      data: { status: "FAILED", error: message },
    });
    return NextResponse.json({ error: message, id: audit.id }, { status: 502 });
  }
}
