import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";

// Contact forms on provisioned company sites (foo.vercel.app) post here —
// cross-origin by design.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const Input = z.object({
  companyId: z.string().min(1).max(64),
  name: z.string().max(120).optional(),
  email: z.string().email().max(200),
  message: z.string().min(5).max(4000),
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Public lead intake for provisioned company websites. Creates a Support-agent
 * task (same shape as the dashboard "Forward to Support" form), so the
 * company's AI drafts a reply and the owner sees the lead in the feed.
 */
export async function POST(request: Request) {
  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Fill in a valid email and a message of 5+ characters." },
      { status: 400, headers: CORS },
    );
  }
  const { companyId, name, email, message } = parsed.data;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, planTier: true, status: true },
  });
  if (!company || company.planTier === "FREE" || company.status === "LAPSED") {
    return NextResponse.json({ error: "This business is not accepting messages right now." }, { status: 404, headers: CORS });
  }

  // Abuse guard: 20 website leads per company per hour.
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.task.count({
    where: { companyId, type: "support_reply", createdAt: { gte: since } },
  });
  if (recent >= 20) {
    return NextResponse.json({ error: "Too many messages right now — please try again later." }, { status: 429, headers: CORS });
  }

  await prisma.$transaction([
    prisma.task.create({
      data: {
        companyId,
        agent: "SUPPORT",
        type: "support_reply",
        title: `Website lead: ${message.slice(0, 70)}`,
        source: "ON_DEMAND",
        status: "PENDING",
        payload: {
          customerMessage: message,
          customerEmail: email,
          ...(name ? { customerName: name } : {}),
          channel: "website_contact_form",
        },
      },
    }),
    prisma.activityLog.create({
      data: {
        companyId,
        agent: "SUPPORT",
        action: `New lead from the website contact form${name ? ` (${name})` : ""} — drafting a reply`,
        isPublic: false,
      },
    }),
  ]);

  return NextResponse.json({ ok: true }, { headers: CORS });
}
