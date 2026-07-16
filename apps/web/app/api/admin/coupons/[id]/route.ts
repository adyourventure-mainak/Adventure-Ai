import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { normalizeCouponCode } from "@adventure/core";
import { getUser } from "@/lib/auth";

const PatchInput = z.object({
  code: z.string().min(3).max(40).optional(),
  percentOff: z.union([z.literal(50), z.literal(70), z.literal(100)]).optional(),
  freeDays: z.number().int().min(1).max(365).optional(),
  note: z.string().max(300).nullable().optional(),
  allowedEmail: z.string().email().max(200).nullable().optional().or(z.literal("")),
  maxRedemptions: z.number().int().min(1).max(100000).nullable().optional(),
  active: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

/** Edit a coupon — including changing the code or deactivating it (admin only). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const parsed = PatchInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  const existing = await prisma.coupon.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  // A code change must stay unique.
  let code: string | undefined;
  if (d.code !== undefined) {
    code = normalizeCouponCode(d.code);
    if (!code) return NextResponse.json({ error: "Enter a code" }, { status: 400 });
    const clash = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
    if (clash && clash.id !== params.id) {
      return NextResponse.json({ error: "Another coupon already uses that code" }, { status: 409 });
    }
  }

  const coupon = await prisma.coupon.update({
    where: { id: params.id },
    data: {
      ...(code !== undefined ? { code } : {}),
      ...(d.percentOff !== undefined ? { percentOff: d.percentOff } : {}),
      ...(d.freeDays !== undefined ? { freeDays: d.freeDays } : {}),
      ...(d.note !== undefined ? { note: d.note || null } : {}),
      ...(d.allowedEmail !== undefined
        ? { allowedEmail: d.allowedEmail ? d.allowedEmail.toLowerCase() : null }
        : {}),
      ...(d.maxRedemptions !== undefined ? { maxRedemptions: d.maxRedemptions } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
      ...(d.expiresAt !== undefined ? { expiresAt: d.expiresAt ? new Date(d.expiresAt) : null } : {}),
    },
  });
  return NextResponse.json({ ok: true, coupon });
}
