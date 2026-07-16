import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { normalizeCouponCode, COUPON_PERCENTS } from "@adventure/core";
import { getUser } from "@/lib/auth";

const CreateInput = z.object({
  code: z.string().min(3).max(40),
  percentOff: z.union([z.literal(50), z.literal(70), z.literal(100)]),
  freeDays: z.number().int().min(1).max(365).default(30),
  note: z.string().max(300).optional(),
  allowedEmail: z.string().email().max(200).optional().or(z.literal("")),
  maxRedemptions: z.number().int().min(1).max(100000).optional(),
  expiresAt: z.string().datetime().optional(),
});

/** List all coupons with their redemptions (admin only). */
export async function GET() {
  const user = await getUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { redemptions: { orderBy: { createdAt: "desc" } } },
  });
  return NextResponse.json({ coupons, percents: COUPON_PERCENTS });
}

/** Create a coupon (admin only). */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const parsed = CreateInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  const code = normalizeCouponCode(d.code);
  if (!code) return NextResponse.json({ error: "Enter a code" }, { status: 400 });

  const exists = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
  if (exists) return NextResponse.json({ error: "A coupon with that code already exists" }, { status: 409 });

  const coupon = await prisma.coupon.create({
    data: {
      code,
      percentOff: d.percentOff,
      freeDays: d.freeDays,
      note: d.note || null,
      allowedEmail: d.allowedEmail ? d.allowedEmail.toLowerCase() : null,
      maxRedemptions: d.maxRedemptions ?? null,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
    },
  });
  return NextResponse.json({ ok: true, coupon });
}
